# Database Migrations Guide

This guide covers database migration procedures for the CS2 Smokes Hub API.

## Overview

The application uses Prisma as the ORM with PostgreSQL as the database. All database changes are managed through Prisma migrations to ensure consistency across environments.

## Migration Commands

### Development

```bash
# Create a new migration (development only)
npm run prisma:migrate

# Reset database and apply all migrations
npm run prisma:migrate:reset

# Check migration status
npm run prisma:migrate:status
```

### Production Deployment

```bash
# Deploy migrations (production safe)
npm run prisma:migrate:deploy

# Or use the comprehensive deployment script
npm run db:deploy
```

## Migration Workflow

### 1. Development Phase

1. **Make schema changes** in `prisma/schema.prisma`
2. **Create migration**:
   ```bash
   npx prisma migrate dev --name descriptive_migration_name
   ```
3. **Test migration** with development data:
   ```bash
   npm run db:reset:dev
   ```

### 2. Staging/Testing Phase

1. **Deploy to staging**:
   ```bash
   npm run prisma:migrate:deploy
   npm run prisma:generate
   npm run prisma:seed
   ```
2. **Run integration tests**
3. **Verify data integrity**

### 3. Production Deployment

1. **Backup production database**
2. **Deploy using the deployment script**:
   ```bash
   npm run db:deploy
   ```
3. **Verify application functionality**
4. **Monitor for issues**

## Migration Best Practices

### Schema Changes

1. **Additive changes first**: Add new columns as nullable, then populate, then make required
2. **Avoid breaking changes**: Don't remove columns that are still in use
3. **Use descriptive names**: Migration names should clearly describe the change
4. **Test thoroughly**: Always test migrations on a copy of production data

### Data Migrations

1. **Separate schema and data**: Create separate migrations for schema changes and data transformations
2. **Handle large datasets**: Use batch processing for large data migrations
3. **Provide rollback strategy**: Document how to reverse data changes if needed

### Production Safety

1. **Always backup**: Create database backup before migrations
2. **Use transactions**: Ensure migrations are atomic where possible
3. **Monitor performance**: Watch for long-running migrations that might lock tables
4. **Plan downtime**: Schedule migrations during low-traffic periods

## Common Migration Scenarios

### Adding a New Column

```prisma
model User {
  id        Int      @id @default(autoincrement())
  steamId   String   @unique
  username  String
  avatarUrl String?
  // New column - start as optional
  email     String?  // Add as nullable first
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Renaming a Column

1. **Step 1**: Add new column
2. **Step 2**: Populate new column with data from old column
3. **Step 3**: Update application code to use new column
4. **Step 4**: Remove old column

### Adding Indexes

```prisma
model Smoke {
  id        Int      @id @default(autoincrement())
  title     String
  createdAt DateTime @default(now())
  
  // Add index for performance
  @@index([createdAt])
  @@index([title])
}
```

## Troubleshooting

### Migration Conflicts

If you encounter migration conflicts:

1. **Development**: Reset and recreate
   ```bash
   npm run db:reset:dev
   ```

2. **Production**: Resolve manually
   ```bash
   npx prisma migrate resolve --applied <migration_name>
   ```

### Failed Migrations

1. **Check migration status**:
   ```bash
   npm run prisma:migrate:status
   ```

2. **Mark as applied** (if migration succeeded but wasn't recorded):
   ```bash
   npx prisma migrate resolve --applied <migration_name>
   ```

3. **Mark as rolled back** (if migration failed and was reverted):
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

### Database Connection Issues

1. **Check DATABASE_URL**: Ensure connection string is correct
2. **Verify database exists**: Create database if it doesn't exist
3. **Check permissions**: Ensure user has necessary privileges
4. **Test connection**: Use `npm run db:manage status`

## Emergency Procedures

### Rollback Migration

Prisma doesn't support automatic rollbacks. To rollback:

1. **Restore from backup**:
   ```bash
   pg_restore -d database_name backup_file.sql
   ```

2. **Reset migration state**:
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

### Database Recovery

If database is corrupted:

1. **Stop application**
2. **Restore from latest backup**
3. **Apply any missing migrations**
4. **Verify data integrity**
5. **Restart application**

## Monitoring and Maintenance

### Regular Tasks

1. **Monitor migration performance**: Track execution times
2. **Review migration history**: Ensure migrations are clean and necessary
3. **Update documentation**: Keep migration notes up to date
4. **Test backup/restore**: Regularly verify backup procedures

### Performance Considerations

1. **Index management**: Add indexes for frequently queried columns
2. **Query optimization**: Monitor slow queries and optimize
3. **Data archival**: Plan for data growth and archival strategies
4. **Connection pooling**: Configure appropriate connection limits

## Environment-Specific Notes

### Development
- Use `npm run db:reset:dev` liberally
- Test all migration scenarios
- Keep development data realistic but not sensitive

### Staging
- Mirror production configuration
- Use production-like data volumes
- Test complete deployment procedures

### Production
- Always backup before migrations
- Use `npm run db:deploy` for safety checks
- Monitor application during and after deployment
- Have rollback plan ready