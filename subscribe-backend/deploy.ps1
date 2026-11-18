<#
Deploys the aieasytouse.com Subscribe backend:
  SES sender identity -> IAM role -> Lambda function -> public Function URL (CORS locked to the site).

Usage:
  ./deploy.ps1 -TurnstileSecret <secret from Cloudflare>
Re-running is safe: it updates the code and settings in place.
#>
param(
    [Parameter(Mandatory = $true)][string]$TurnstileSecret,
    [string]$NotifyTo = 'info@bizdatasolutions.com',
    [string]$MailFrom = 'info@bizdatasolutions.com',
    [string]$Region = 'us-east-1',
    [string]$FunctionName = 'aieasytouse-subscribe',
    [string]$RoleName = 'aieasytouse-subscribe-role',
    [string[]]$AllowedOrigins = @('https://www.aieasytouse.com', 'https://aieasytouse.com'),
    [string]$AllowedHosts = 'www.aieasytouse.com,aieasytouse.com'
)

$ErrorActionPreference = 'Stop'
function Invoke-Aws { $out = & aws.exe @args --region $Region 2>&1; if ($LASTEXITCODE -ne 0) { throw "aws $($args -join ' ') failed:`n$out" }; return $out }
function Test-Aws { $out = & aws.exe @args --region $Region 2>&1; return @{ ok = ($LASTEXITCODE -eq 0); out = $out } }

$account = (Invoke-Aws sts get-caller-identity --query Account --output text).Trim()
Write-Host "AWS account $account, region $Region"

# 1. SES sender identity
$id = Test-Aws sesv2 get-email-identity --email-identity $MailFrom --output json
if (-not $id.ok) {
    Invoke-Aws sesv2 create-email-identity --email-identity $MailFrom | Out-Null
    Write-Host "SES: verification email sent to $MailFrom. Click the link in it before sign-ups can be delivered." -ForegroundColor Yellow
} else {
    $verified = ($id.out | Out-String | ConvertFrom-Json).VerifiedForSendingStatus
    Write-Host "SES: $MailFrom verified for sending = $verified"
}

# 2. IAM role
$trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
$trustFile = New-TemporaryFile; Set-Content $trustFile $trust -Encoding ascii
$role = Test-Aws iam get-role --role-name $RoleName --query Role.Arn --output text
if (-not $role.ok) {
    $roleArn = (Invoke-Aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$trustFile" --query Role.Arn --output text).Trim()
    Invoke-Aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole | Out-Null
    Write-Host 'IAM: role created, waiting for it to propagate...'
    Start-Sleep -Seconds 12
} else { $roleArn = ($role.out | Out-String).Trim() }
$sesPolicy = @"
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendEmail"],"Resource":"arn:aws:ses:${Region}:${account}:identity/*","Condition":{"StringEquals":{"ses:FromAddress":"$MailFrom"}}}]}
"@
$polFile = New-TemporaryFile; Set-Content $polFile $sesPolicy -Encoding ascii
Invoke-Aws iam put-role-policy --role-name $RoleName --policy-name ses-send-signups --policy-document "file://$polFile" | Out-Null
Write-Host "IAM: $roleArn"

# 3. Lambda function
$zip = Join-Path ([IO.Path]::GetTempPath()) "$FunctionName.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $PSScriptRoot 'lambda\index.mjs') -DestinationPath $zip
$envJson = @{ Variables = @{ TURNSTILE_SECRET = $TurnstileSecret; NOTIFY_TO = $NotifyTo; MAIL_FROM = $MailFrom; ALLOWED_HOSTS = $AllowedHosts } } | ConvertTo-Json -Compress
$envFile = New-TemporaryFile; Set-Content $envFile $envJson -Encoding ascii

$fn = Test-Aws lambda get-function --function-name $FunctionName --output json
if (-not $fn.ok) {
    Invoke-Aws lambda create-function --function-name $FunctionName --runtime nodejs22.x --handler index.handler `
        --role $roleArn --zip-file "fileb://$zip" --timeout 10 --memory-size 256 `
        --environment "file://$envFile" | Out-Null
    Invoke-Aws lambda wait function-active-v2 --function-name $FunctionName | Out-Null
    Write-Host 'Lambda: function created'
} else {
    Invoke-Aws lambda update-function-code --function-name $FunctionName --zip-file "fileb://$zip" | Out-Null
    Invoke-Aws lambda wait function-updated-v2 --function-name $FunctionName | Out-Null
    Invoke-Aws lambda update-function-configuration --function-name $FunctionName --environment "file://$envFile" --timeout 10 | Out-Null
    Invoke-Aws lambda wait function-updated-v2 --function-name $FunctionName | Out-Null
    Write-Host 'Lambda: function updated'
}
Remove-Item $envFile, $trustFile, $polFile -ErrorAction SilentlyContinue

# 4. Public Function URL, CORS restricted to the site
$cors = @{ AllowOrigins = $AllowedOrigins; AllowMethods = @('POST'); AllowHeaders = @('content-type'); MaxAge = 86400 } | ConvertTo-Json -Compress
$corsFile = New-TemporaryFile; Set-Content $corsFile $cors -Encoding ascii
$url = Test-Aws lambda get-function-url-config --function-name $FunctionName --query FunctionUrl --output text
if (-not $url.ok) {
    $fnUrl = (Invoke-Aws lambda create-function-url-config --function-name $FunctionName --auth-type NONE --cors "file://$corsFile" --query FunctionUrl --output text).Trim()
    Invoke-Aws lambda add-permission --function-name $FunctionName --statement-id public-url --action lambda:InvokeFunctionUrl `
        --principal '*' --function-url-auth-type NONE | Out-Null
    $p = Test-Aws lambda add-permission --function-name $FunctionName --statement-id public-url-invoke --action lambda:InvokeFunction `
        --principal '*' --invoked-via-function-url
    if (-not $p.ok) { Write-Host 'Note: InvokeFunction-via-URL permission not added (older CLI or not required).' }
} else {
    $fnUrl = ($url.out | Out-String).Trim()
    Invoke-Aws lambda update-function-url-config --function-name $FunctionName --cors "file://$corsFile" | Out-Null
}
Remove-Item $corsFile -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "Subscribe endpoint: $fnUrl" -ForegroundColor Green
Write-Host 'Put this URL in the data-endpoint attribute of the newsletter form in index.html.'
