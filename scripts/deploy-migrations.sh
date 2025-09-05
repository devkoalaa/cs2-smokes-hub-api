#!/bin/bash

# CS2 Smokes Hub API - Database Migration Deployment Script
# This script safely deploys database migrations in production

set -e  # Exit on any error

echo "🚀 CS2 Smokes Hub API - Database Migration Deployment"
echo "=================================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL before running this script"
    exit 1
fi

echo "✅ DATABASE_URL is configured"

# Check migration status
echo "📊 Checking current migration status..."
npx prisma migrate status

# Ask for confirmation in production
if [ "$NODE_ENV" = "production" ]; then
    echo ""
    echo "⚠️  WARNING: You are about to deploy migrations to PRODUCTION"
    echo "Please ensure you have:"
    echo "  1. Backed up the production database"
    echo "  2. Tested these migrations on staging"
    echo "  3. Reviewed all migration files"
    echo ""
    read -p "Do you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "❌ Migration deployment cancelled"
        exit 1
    fi
fi

# Deploy migrations
echo "🔄 Deploying migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Seed database if it's empty (only in non-production)
if [ "$NODE_ENV" != "production" ]; then
    echo "🌱 Seeding database with initial data..."
    npm run prisma:seed
else
    echo "ℹ️  Skipping seeding in production environment"
    echo "   Run 'npm run prisma:seed' manually if needed"
fi

echo ""
echo "✅ Database migration deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Verify application starts correctly"
echo "  2. Run smoke tests to ensure functionality"
echo "  3. Monitor application logs for any issues"