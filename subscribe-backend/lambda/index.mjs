// Subscribe handler for aieasytouse.com
// 1. Verifies the Cloudflare Turnstile token (proves a human submitted the form).
// 2. Validates the email address.
// 3. Emails the sign-up to NOTIFY_TO through Amazon SES.
//
// Environment variables (set by deploy.ps1):
//   TURNSTILE_SECRET  Cloudflare Turnstile secret key
//   NOTIFY_TO         Where sign-ups are sent (info@bizdatasolutions.com)
//   MAIL_FROM         SES-verified sender address
//   ALLOWED_HOSTS     Comma-separated hostnames Turnstile tokens must come from

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({});
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.requestContext?.http?.method !== 'POST') {
    return reply(405, { ok: false, error: 'Method not allowed' });
  }

  let data;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
    data = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: 'Invalid request' });
  }

  const email = String(data.email || '').trim().toLowerCase();
  const token = String(data.token || '');
  const honeypot = String(data.company || '');
  const page = String(data.page || '').slice(0, 300);

  // Bots fill hidden fields; pretend success so they learn nothing.
  if (honeypot) return reply(200, { ok: true });

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return reply(400, { ok: false, error: 'Please enter a valid email address.' });
  }
  if (!token) {
    return reply(400, { ok: false, error: 'Please complete the human verification.' });
  }

  // Verify the Turnstile token with Cloudflare.
  const ip = event.requestContext?.http?.sourceIp || '';
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token, remoteip: ip });
  let verdict;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    verdict = await res.json();
  } catch (err) {
    console.error('Turnstile verification request failed', err);
    return reply(502, { ok: false, error: 'Verification service unavailable. Please try again.' });
  }

  const allowedHosts = (process.env.ALLOWED_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean);
  if (!verdict.success || (allowedHosts.length && !allowedHosts.includes(verdict.hostname))) {
    console.warn('Turnstile rejected', { codes: verdict['error-codes'], hostname: verdict.hostname });
    return reply(403, { ok: false, error: 'Human verification failed. Please try again.' });
  }

  const when = new Date().toISOString();
  const text = [
    'New subscriber for The Brief (aieasytouse.com)',
    '',
    `Email:     ${email}`,
    `Submitted: ${when}`,
    `Page:      ${page || 'unknown'}`,
    'Verified:  Cloudflare Turnstile (human check passed)',
  ].join('\n');

  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: process.env.MAIL_FROM,
      Destination: { ToAddresses: [process.env.NOTIFY_TO] },
      ReplyToAddresses: [email],
      Content: {
        Simple: {
          Subject: { Data: `New subscriber: ${email}`, Charset: 'UTF-8' },
          Body: { Text: { Data: text, Charset: 'UTF-8' } },
        },
      },
    }));
  } catch (err) {
    console.error('SES send failed', err);
    return reply(500, { ok: false, error: 'Something went wrong. Please try again later.' });
  }

  return reply(200, { ok: true });
};
