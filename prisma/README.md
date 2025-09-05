# Database Management

This directory contains all database-related files for the CS2 Smokes Hub API.

## Files

- `schema.prisma` - Prisma schema definition with all models and relationships
- `seed.ts` - Production seed script with essential map data
- `seed-dev.ts` - Development seed script with comprehensive test data
- `migrations/` - Database migration files

## Available Scripts

### Basic Prisma Commands

```bash
# Generate Prisma client
npm run prisma:generate

# Create and apply a new migration (development)
npm run prisma:migrate

# Deploy migrations (production)
npm run prisma:migrate:deploy

# Reset database and apply all migrations
npm run prisma:migrate:reset

# Check migration status
npm run prisma:migrate:status

# Open Prisma Studio
npm run prisma:studio
```

### Seeding Commands

```bash
# Seed with production data (maps only)
npm run prisma:seed

# Seed with development test data (maps, users, smokes, ratings, reports)
npm run prisma:seed:dev
```

### Database Setup Commands

```bash
# Setup database for production (migrate + generate + seed)
npm run db:setup

# Setup database for development (migrate + generate + seed with test data)
npm run db:setup:dev

# Reset database with production data
npm run db:reset

# Reset database with development test data
npm run db:reset:dev
```

### Database Management Tool

```bash
# Show all available commands
npm run db:manage

# Reset with production data
npm run db:manage reset

# Reset with development data
npm run db:manage reset-dev

# Run migrations
npm run db:manage migrate

# Deploy migrations (production)
npm run db:manage migrate-deploy

# Seed with production data
npm run db:manage seed

# Seed with development data
npm run db:manage seed-dev

# Check migration status
npm run db:manage status

# Open Prisma Studio
npm run db:manage studio

# Clean all data (dangerous!)
npm run db:manage clean
```

## Development Workflow

### Initial Setup

1. Set up your environment variables in `.env`:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/cs2_smokes_hub"
   ```

2. Set up the database:
   ```bash
   npm run db:setup:dev
   ```

### Daily Development

- Use `npm run db:reset:dev` to reset with fresh test data
- Use `npm run prisma:studio` to inspect data visually
- Use `npm run db:manage status` to check migration status

### Production Deployment

1. Deploy migrations:
   ```bash
   npm run prisma:migrate:deploy
   ```

2. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

3. Seed with production data:
   ```bash
   npm run prisma:seed
   ```

Or use the combined command:
```bash
npm run db:setup
```

## Seed Data

### Production Seed (`seed.ts`)
- 9 CS2 maps (Dust2, Mirage, Inferno, Cache, Overpass, Vertigo, Ancient, Anubis, Nuke)

### Development Seed (`seed-dev.ts`)
- 3 maps (Dust2, Mirage, Inferno)
- 3 test users with Steam IDs
- 5 test smokes with realistic coordinates
- 7 test ratings (mix of upvotes and downvotes)
- 2 test reports for content moderation testing

## Migration Best Practices

1. Always create descriptive migration names
2. Test migrations on development data before production
3. Backup production database before running migrations
4. Use `prisma migrate deploy` for production (never `prisma migrate dev`)
5. Check migration status with `prisma migrate status` before deployment

## Troubleshooting

### Common Issues

1. **Migration conflicts**: Reset development database with `npm run db:reset:dev`
2. **Prisma client out of sync**: Run `npm run prisma:generate`
3. **Connection issues**: Check DATABASE_URL in `.env`
4. **Seed failures**: Ensure database is empty or use reset commands

### Emergency Recovery

If you need to completely reset everything:

```bash
# Clean all data
npm run db:manage clean

# Reset with fresh migrations and data
npm run db:reset:dev
```