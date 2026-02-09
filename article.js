/**
 * AI Fluency Blog - Article Interactions
 * ======================================
 */

document.addEventListener('DOMContentLoaded', () => {
    initReadingProgress();
    initTableOfContents();
    initSectionAnimations();
    initShareButtons();
    initSmoothScrollArticle();
});

/**
 * Reading Progress Bar
 */
function initReadingProgress() {
    const progressBar = document.querySelector('.progress-bar');
    const article = document.querySelector('.article-main');

    if (!progressBar || !article) return;

    function updateProgress() {
        const articleTop = article.offsetTop;
        const articleHeight = article.offsetHeight;
        const windowHeight = window.innerHeight;
        const scrollY = window.scrollY;

        // Calculate how far through the article we've scrolled
        const start = articleTop - windowHeight;
        const end = articleTop + articleHeight - windowHeight;
        const current = scrollY - start;
        const total = end - start;

        let progress = (current / total) * 100;
        progress = Math.max(0, Math.min(100, progress));

        progressBar.style.width = `${progress}%`;
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
}

/**
 * Table of Contents Active State
 */
function initTableOfContents() {
    const tocLinks = document.querySelectorAll('.toc-link');
    const sections = document.querySelectorAll('.article-section');

    if (!tocLinks.length || !sections.length) return;

    const observerOptions = {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                updateActiveLink(id);
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));

    function updateActiveLink(id) {
        tocLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${id}`) {
                link.classList.add('active');
            }
        });
    }
}

/**
 * Section Entry Animations
 */
function initSectionAnimations() {
    const animatedElements = document.querySelectorAll(
        '.highlight-stat, .callout, .data-visualization, .pull-quote, ' +
        '.analogy-box, .comparison-grid, .concept-card, .spectrum-visual, ' +
        '.limitation-card, .risk-cascade, .method-card, .takeaway-card, ' +
        '.next-article'
    );

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    animatedElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.03}s,
                               transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.03}s`;
        observer.observe(el);
    });

    // Animate section headings
    const headings = document.querySelectorAll('.section-heading');
    headings.forEach(heading => {
        heading.style.opacity = '0';
        heading.style.transform = 'translateX(-20px)';
        heading.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

        const headingObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    headingObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        headingObserver.observe(heading);
    });
}

/**
 * Share Buttons Functionality
 */
function initShareButtons() {
    const shareButtons = document.querySelectorAll('.share-btn, .share-article');
    const pageUrl = encodeURIComponent(window.location.href);
    const pageTitle = encodeURIComponent(document.title);

    shareButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const label = btn.getAttribute('aria-label') || btn.textContent;

            if (label.includes('LinkedIn')) {
                window.open(
                    `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`,
                    '_blank',
                    'width=600,height=400'
                );
            } else if (label.includes('Twitter')) {
                window.open(
                    `https://twitter.com/intent/tweet?url=${pageUrl}&text=${pageTitle}`,
                    '_blank',
                    'width=600,height=400'
                );
            } else if (label.includes('Copy') || label.includes('Share')) {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    showToast('Link copied to clipboard!');
                });
            }
        });
    });
}

/**
 * Toast Notification
 */
function showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    // Add toast styles
    toast.style.cssText = `
        position: fixed;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        padding: 16px 24px;
        background: var(--text-primary);
        color: var(--bg-primary);
        font-family: var(--font-display);
        font-size: 0.875rem;
        font-weight: 500;
        border-radius: 8px;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Remove after delay
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Smooth Scroll for Article Links
 */
function initSmoothScrollArticle() {
    document.querySelectorAll('.toc-link, a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (!href.startsWith('#')) return;

            e.preventDefault();
            const target = document.querySelector(href);

            if (target) {
                const navHeight = document.querySelector('.nav').offsetHeight;
                const targetPosition = target.offsetTop - navHeight - 40;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Update URL without jumping
                history.pushState(null, null, href);
            }
        });
    });
}

/**
 * Reading Time Estimate (if needed dynamically)
 */
function calculateReadingTime() {
    const article = document.querySelector('.article-main');
    if (!article) return 0;

    const text = article.textContent || '';
    const wordCount = text.trim().split(/\s+/).length;
    const wordsPerMinute = 200;

    return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Highlight Text Selection for Sharing
 */
document.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Remove existing tooltip
    const existingTooltip = document.querySelector('.selection-tooltip');
    if (existingTooltip) existingTooltip.remove();

    if (selectedText.length > 20 && selectedText.length < 500) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const tooltip = document.createElement('div');
        tooltip.className = 'selection-tooltip';
        tooltip.innerHTML = `
            <button class="tooltip-btn tweet-selection">Tweet</button>
            <button class="tooltip-btn copy-selection">Copy</button>
        `;

        tooltip.style.cssText = `
            position: fixed;
            top: ${rect.top - 50}px;
            left: ${rect.left + (rect.width / 2)}px;
            transform: translateX(-50%);
            display: flex;
            gap: 8px;
            padding: 8px;
            background: var(--bg-elevated, #1f1f23);
            border: 1px solid var(--border-medium, rgba(255,255,255,0.1));
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(tooltip);

        // Style buttons
        tooltip.querySelectorAll('.tooltip-btn').forEach(btn => {
            btn.style.cssText = `
                padding: 6px 12px;
                background: transparent;
                border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
                border-radius: 4px;
                color: var(--text-primary, #fafafa);
                font-family: var(--font-display, sans-serif);
                font-size: 0.75rem;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
        });

        // Tweet button
        tooltip.querySelector('.tweet-selection').addEventListener('click', () => {
            const tweetText = encodeURIComponent(`"${selectedText}" — AI Fluency`);
            const tweetUrl = encodeURIComponent(window.location.href);
            window.open(
                `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`,
                '_blank',
                'width=600,height=400'
            );
            tooltip.remove();
        });

        // Copy button
        tooltip.querySelector('.copy-selection').addEventListener('click', () => {
            navigator.clipboard.writeText(selectedText).then(() => {
                showToast('Quote copied!');
                tooltip.remove();
            });
        });

        // Remove tooltip on click elsewhere
        document.addEventListener('mousedown', function handler(e) {
            if (!tooltip.contains(e.target)) {
                tooltip.remove();
                document.removeEventListener('mousedown', handler);
            }
        });
    }
});

/**
 * Keyboard Navigation
 */
document.addEventListener('keydown', (e) => {
    // Press 'j' to scroll to next section
    if (e.key === 'j' && !e.ctrlKey && !e.metaKey && !isTyping()) {
        const sections = document.querySelectorAll('.article-section');
        const scrollY = window.scrollY;
        const navHeight = document.querySelector('.nav').offsetHeight;

        for (const section of sections) {
            if (section.offsetTop - navHeight - 60 > scrollY) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                break;
            }
        }
    }

    // Press 'k' to scroll to previous section
    if (e.key === 'k' && !e.ctrlKey && !e.metaKey && !isTyping()) {
        const sections = Array.from(document.querySelectorAll('.article-section')).reverse();
        const scrollY = window.scrollY;
        const navHeight = document.querySelector('.nav').offsetHeight;

        for (const section of sections) {
            if (section.offsetTop - navHeight - 60 < scrollY - 100) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                break;
            }
        }
    }
});

function isTyping() {
    const active = document.activeElement;
    return active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable;
}

/**
 * Estimated Position Indicator
 */
function initPositionIndicator() {
    const sections = document.querySelectorAll('.article-section');
    const totalSections = sections.length;

    const indicator = document.createElement('div');
    indicator.className = 'position-indicator';
    indicator.innerHTML = `<span class="current">1</span>/<span class="total">${totalSections}</span>`;

    indicator.style.cssText = `
        position: fixed;
        bottom: 40px;
        right: 40px;
        padding: 12px 16px;
        background: var(--bg-elevated, #1f1f23);
        border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
        border-radius: 8px;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--text-secondary);
        z-index: 100;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    document.body.appendChild(indicator);

    const currentSpan = indicator.querySelector('.current');

    let isVisible = false;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = Array.from(sections).indexOf(entry.target) + 1;
                currentSpan.textContent = index;
            }
        });
    }, { rootMargin: '-30% 0px -60% 0px' });

    sections.forEach(section => observer.observe(section));

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const articleStart = document.querySelector('.article-main')?.offsetTop || 0;
        const articleEnd = articleStart + (document.querySelector('.article-main')?.offsetHeight || 0);

        if (scrollY > articleStart && scrollY < articleEnd - window.innerHeight) {
            if (!isVisible) {
                indicator.style.opacity = '1';
                isVisible = true;
            }
        } else {
            if (isVisible) {
                indicator.style.opacity = '0';
                isVisible = false;
            }
        }
    }, { passive: true });
}

// Initialize position indicator
initPositionIndicator();
