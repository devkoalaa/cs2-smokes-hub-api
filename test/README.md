# Integration Tests

This directory contains integration tests for the CS2 Smokes Hub API database operations.

## Overview

The integration tests verify that the Prisma database operations work correctly with the PostgreSQL database. These tests cover:

- **Basic CRUD Operations**: Create, read, update, delete operations for all models
- **Relationship Integrity**: Foreign key constraints and relationships between models
- **Cascade Delete Behavior**: Proper cascade deletion when parent records are removed
- **Transaction Handling**: Multi-table operations within database transactions
- **Error Handling**: Proper error responses for constraint violations and invalid operations

## Test Structure

### Service Initialization
- Verifies PrismaService is properly initialized
- Confirms all database models are available
- Validates transaction support

### Database Schema Validation
- Tests that all CRUD methods are available for each model
- Verifies model structure matches expectations
- Confirms upsert operations for ratings

### Database Connection Management
- Tests connection lifecycle methods
- Validates raw query support
- Confirms proper connection/disconnection handling

### Transaction Support
- Verifies transaction operations work correctly
- Tests rollback behavior on errors
- Validates complex multi-table transactions
- Tests transaction timeout handling

### Error Handling Structure
- Tests constraint violation handling
- Validates foreign key error responses
- Confirms proper error formatting

### Model Relationships
- Tests User-Smoke relationships
- Validates Smoke-Rating relationships
- Confirms Smoke-Report relationships
- Tests Map-Smoke relationships

### Query Operations Structure
- Tests complex filtering operations
- Validates aggregation queries
- Confirms upsert operations for ratings

### Data Validation Structure
- Tests required field validation
- Validates data type constraints
- Confirms business rule enforcement

### Cascade Delete Structure
- Tests cascade delete configuration
- Validates foreign key constraints
- Confirms proper cleanup on deletions

## Running the Tests

### Prerequisites

1. **Database Setup**: The tests can run in two modes:
   - **With Database**: Set `DATABASE_URL` environment variable to a test PostgreSQL database
   - **Without Database**: Tests will run with mocked operations to verify structure

2. **Environment Variables**:
   ```bash
   # Optional: For full integration testing with real database
   DATABASE_URL=postgresql://username:password@localhost:5432/test_database
   ```

### Commands

```bash
# Run integration tests
npm run test:integration

# Run with coverage
npm run test:integration -- --coverage

# Run specific test file
npm run test:integration -- database-operations.integration-spec.ts

# Run in watch mode
npm run test:integration -- --watch
```

## Test Configuration

The integration tests use a separate Jest configuration file:

- **Config File**: `test/jest-integration.json`
- **Test Pattern**: `*.integration-spec.ts`
- **Environment**: Node.js
- **Module Mapping**: Configured for TypeScript path resolution

## Database Requirements

### For Full Integration Testing

If you want to run tests against a real database:

1. **PostgreSQL Database**: Set up a test PostgreSQL database
2. **Prisma Schema**: Ensure the database schema matches `prisma/schema.prisma`
3. **Migrations**: Run `npx prisma migrate dev` to apply schema
4. **Environment**: Set `DATABASE_URL` to your test database

### Test Database Schema

The tests expect the following models:
- **User**: Steam authentication and user profiles
- **Map**: CS2 map information
- **Smoke**: Smoke grenade strategies
- **Rating**: User ratings for smokes (1 or -1)
- **Report**: Content moderation reports

### Relationships Tested

1. **User → Smoke**: One-to-many (users can create multiple smokes)
2. **Map → Smoke**: One-to-many (maps can have multiple smokes)
3. **User → Rating**: One-to-many (users can rate multiple smokes)
4. **Smoke → Rating**: One-to-many (smokes can have multiple ratings)
5. **User → Report**: One-to-many (users can create multiple reports)
6. **Smoke → Report**: One-to-many (smokes can have multiple reports)

### Constraints Tested

1. **Unique Constraints**:
   - User.steamId (unique Steam ID per user)
   - Map.name (unique map names)
   - Rating(userId, smokeId) (one rating per user per smoke)

2. **Foreign Key Constraints**:
   - Smoke.authorId → User.id
   - Smoke.mapId → Map.id
   - Rating.userId → User.id
   - Rating.smokeId → Smoke.id
   - Report.reporterId → User.id
   - Report.smokeId → Smoke.id

3. **Cascade Deletes**:
   - Delete User → Delete associated Smokes, Ratings, Reports
   - Delete Map → Delete associated Smokes
   - Delete Smoke → Delete associated Ratings, Reports

## Test Data Management

### Cleanup Strategy
- Each test starts with a clean database state
- All tables are cleared before each test in dependency order
- Tests are isolated and don't affect each other

### Mock Data
- When running without a database, operations are mocked
- Mock data follows the same structure as real database records
- Error scenarios are simulated for constraint violations

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Ensure PostgreSQL is running
   - Verify DATABASE_URL is correct
   - Check database permissions

2. **Schema Mismatch**:
   - Run `npx prisma generate` to update client
   - Apply migrations with `npx prisma migrate dev`

3. **Test Timeouts**:
   - Increase Jest timeout in configuration
   - Check database performance
   - Verify network connectivity

### Debug Mode

To debug integration tests:

```bash
# Run with debug output
npm run test:integration -- --verbose

# Run single test with debugging
npm run test:integration -- --testNamePattern="should create and retrieve a user"
```

## Coverage

The integration tests provide coverage for:

- ✅ Database connection management
- ✅ CRUD operations for all models
- ✅ Relationship integrity
- ✅ Constraint validation
- ✅ Cascade delete behavior
- ✅ Transaction handling
- ✅ Error scenarios
- ✅ Complex query operations

## Requirements Mapping

These tests fulfill the following requirements from the specification:

- **Requirement 8.2**: Database operations with Prisma Client
- **Requirement 8.4**: Error handling for database operations

The tests ensure that:
1. All Prisma operations work correctly with the PostgreSQL database
2. Relationship integrity is maintained through foreign key constraints
3. Cascade delete behavior works as expected for data cleanup
4. Transaction handling supports multi-table operations with proper rollback
5. Error handling provides appropriate responses for constraint violations