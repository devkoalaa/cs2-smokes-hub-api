# CS2 Smokes Hub API - Database Migration Deployment Script (PowerShell)
# This script safely deploys database migrations in production

$ErrorActionPreference = "Stop"

Write-Host "🚀 CS2 Smokes Hub API - Database Migration Deployment" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host "Please set DATABASE_URL before running this script" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ DATABASE_URL is configured" -ForegroundColor Green

# Check migration status
Write-Host "📊 Checking current migration status..." -ForegroundColor Blue
npx prisma migrate status

# Ask for confirmation in production
if ($env:NODE_ENV -eq "production") {
    Write-Host ""
    Write-Host "⚠️  WARNING: You are about to deploy migrations to PRODUCTION" -ForegroundColor Yellow
    Write-Host "Please ensure you have:" -ForegroundColor Yellow
    Write-Host "  1. Backed up the production database" -ForegroundColor Yellow
    Write-Host "  2. Tested these migrations on staging" -ForegroundColor Yellow
    Write-Host "  3. Reviewed all migration files" -ForegroundColor Yellow
    Write-Host ""
    
    $confirm = Read-Host "Do you want to continue? (yes/no)"
    
    if ($confirm -ne "yes") {
        Write-Host "❌ Migration deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

# Deploy migrations
Write-Host "🔄 Deploying migrations..." -ForegroundColor Blue
npx prisma migrate deploy

# Generate Prisma client
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Blue
npx prisma generate

# Seed database if it's empty (only in non-production)
if ($env:NODE_ENV -ne "production") {
    Write-Host "🌱 Seeding database with initial data..." -ForegroundColor Blue
    npm run prisma:seed
} else {
    Write-Host "ℹ️  Skipping seeding in production environment" -ForegroundColor Cyan
    Write-Host "   Run 'npm run prisma:seed' manually if needed" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "✅ Database migration deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Blue
Write-Host "  1. Verify application starts correctly" -ForegroundColor White
Write-Host "  2. Run smoke tests to ensure functionality" -ForegroundColor White
Write-Host "  3. Monitor application logs for any issues" -ForegroundColor White