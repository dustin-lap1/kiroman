# Kiroman Deployment Script
# Builds the React app, syncs to S3, and invalidates CloudFront

$ErrorActionPreference = "Stop"

# Configuration
$BUCKET_NAME = "kiroman-site"
$DISTRIBUTION_ID = "DISTRIBUTION_ID_HERE"
$AWS_PROFILE = "kiroman-terraform"
$AWS_REGION = "us-east-1"

Write-Host "=== Kiroman Deployment ===" -ForegroundColor Cyan

# Step 1: Build
Write-Host "[1/3] Building React app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}
Write-Host "Build complete." -ForegroundColor Green

# Step 2: Sync to S3
Write-Host "[2/3] Syncing to S3..." -ForegroundColor Yellow
aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete --region $AWS_REGION --profile $AWS_PROFILE
if ($LASTEXITCODE -ne 0) {
    Write-Host "S3 sync failed." -ForegroundColor Red
    exit 1
}
Write-Host "S3 sync complete." -ForegroundColor Green

# Step 3: Invalidate CloudFront
Write-Host "[3/3] Invalidating CloudFront cache..." -ForegroundColor Yellow
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*" --region $AWS_REGION --profile $AWS_PROFILE | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "CloudFront invalidation failed." -ForegroundColor Red
    exit 1
}
Write-Host "CloudFront invalidation created." -ForegroundColor Green

Write-Host "=== Deployment complete ===" -ForegroundColor Cyan
