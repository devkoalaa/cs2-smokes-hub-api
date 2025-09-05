b# Implementation Plan

- [x] 1. Set up project foundation and core configuration





  - Initialize NestJS project with TypeScript configuration
  - Install and configure required dependencies (Prisma, Passport, JWT, class-validator)
  - Set up environment configuration with validation for DATABASE_URL, JWT_SECRET, STEAM_API_KEY
  - Configure Prisma with PostgreSQL connection and generate client
  - _Requirements: 8.1, 8.3, 9.1_

- [x] 2. Implement database schema and Prisma integration





  - Create Prisma schema file with User, Map, Smoke, Rating, and Report models
  - Generate Prisma client and run initial migration
  - Create PrismaModule as global module with PrismaService
  - Implement database connection lifecycle management in PrismaService
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 3. Create core DTOs and validation classes









  - Implement CreateSmokeDto with class-validator decorators for title, videoUrl, timestamp, coordinates, mapId
  - Implement RateSmokeDto with validation for value field (must be 1 or -1)
  - Implement ReportSmokeDto with validation for reason field (min 10, max 500 characters)
  - Create response DTOs for consistent API responses
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 4. Implement JWT authentication infrastructure





  - Create JwtStrategy class extending PassportStrategy for JWT validation
  - Implement JwtAuthGuard extending AuthGuard('jwt') for route protection
  - Configure JwtModule with secret and expiration settings
  - Create JWT payload interface and validation logic
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 5. Implement Steam authentication strategy and service





  - Create SteamStrategy class extending PassportStrategy for Steam OpenID
  - Configure Steam strategy with API key and callback URL
  - Implement AuthService with validateSteamUser method for user creation/update
  - Implement generateJwtToken method in AuthService
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 6. Create AuthModule and authentication endpoints





  - Implement AuthController with /auth/steam, /auth/steam/return, and /auth/me endpoints
  - Wire up Steam authentication flow with proper redirects and callbacks
  - Implement protected /auth/me endpoint using JwtAuthGuard
  - Add proper error handling for authentication failures
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 7. Implement MapsModule with service and controller





  - Create MapsService with findAll and findById methods using Prisma
  - Implement MapsController with GET /maps and GET /maps/:id endpoints
  - Add proper error handling for invalid map IDs (404 responses)
  - Create unit tests for MapsService database operations
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 8. Implement SmokesService with CRUD operations and score calculation





  - Create SmokesService with findByMapId method including rating score calculation
  - Implement create method with authorId assignment from JWT payload
  - Implement delete method with ownership validation (user can only delete own smokes)
  - Add Prisma queries with proper joins for author and map data
  - _Requirements: 3.1, 3.2, 3.3, 4.2, 4.3, 5.1, 5.2_

- [x] 9. Create SmokesController with protected endpoints





  - Implement GET /maps/:mapId/smokes endpoint with score calculation
  - Implement POST /smokes endpoint with JwtAuthGuard and CreateSmokeDto validation
  - Implement DELETE /smokes/:id endpoint with ownership verification
  - Add proper error handling for invalid mapId, unauthorized access, and not found scenarios
  - _Requirements: 3.1, 3.4, 4.1, 4.4, 4.5, 5.3, 5.4_

- [x] 10. Implement RatingsService with upsert functionality





  - Create RatingsService with upsertRating method using Prisma upsert operation
  - Implement logic to handle rating updates (change existing vote)
  - Add validation for rating values (must be 1 or -1)
  - Create unit tests for upsert logic and constraint handling
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 11. Create RatingsController with protected rating endpoint





  - Implement POST /smokes/:smokeId/rate endpoint with JwtAuthGuard
  - Add RateSmokeDto validation for request body
  - Extract userId from JWT payload for rating creation
  - Add error handling for invalid smokeId and unauthorized access
  - _Requirements: 6.1, 6.4, 6.5_

- [x] 12. Implement ReportsService for content moderation





  - Create ReportsService with create method for new reports
  - Set default status to "PENDING" for new reports
  - Implement proper foreign key relationships with User and Smoke models
  - Add validation for report creation with required reason field
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 13. Create ReportsController with protected reporting endpoint





  - Implement POST /smokes/:smokeId/report endpoint with JwtAuthGuard
  - Add ReportSmokeDto validation for request body
  - Extract reporterId from JWT payload for report creation
  - Add error handling for invalid smokeId and unauthorized access
  - _Requirements: 7.1, 7.4, 7.5_

- [x] 14. Implement global exception filter and error handling













  - Create GlobalExceptionFilter for consistent error response formatting
  - Add specific handling for Prisma errors (not found, constraint violations)
  - Implement validation error aggregation with detailed field messages
  - Add request context logging for debugging and monitoring
  - _Requirements: 8.4, 10.1, 10.2, 10.3, 10.4_

- [x] 15. Create comprehensive unit tests for services





  - Write unit tests for AuthService covering Steam validation and JWT generation
  - Create unit tests for SmokesService covering CRUD operations and ownership validation
  - Implement unit tests for RatingsService focusing on upsert logic
  - Add unit tests for ReportsService covering report creation
  - _Requirements: All service-level requirements_

- [x] 16. Implement integration tests for database operations





  - Create integration tests for Prisma operations with test database
  - Test relationship integrity and foreign key constraints
  - Verify cascade delete behavior for ratings and reports
  - Test transaction handling for multi-table operations
  - _Requirements: 8.2, 8.4_

- [x] 17. Create end-to-end tests for complete API workflows





  - Implement E2E tests for authentication flow (Steam login → JWT → protected access)
  - Create E2E tests for smoke creation workflow (auth → create → rate → report)
  - Test cross-module interactions (smoke creation with map validation)
  - Add E2E tests for error scenarios and edge cases
  - _Requirements: All endpoint requirements_

- [x] 18. Set up application bootstrap and module configuration





  - Configure main.ts with global pipes, filters, and validation
  - Set up AppModule with proper module imports and configuration
  - Configure CORS settings for frontend integration
  - Add Swagger/OpenAPI documentation setup
  - _Requirements: 10.1, 9.4_

- [x] 19. Add database seeding and migration scripts





  - Create seed script for initial map data
  - Implement database migration commands for deployment
  - Add development data seeding for testing
  - Create database reset scripts for development environment
  - _Requirements: 8.3_

- [x] 20. Implement final integration and deployment preparation





  - Verify all endpoints work correctly with proper authentication
  - Test complete user workflows from registration to content interaction
  - Validate all error scenarios return appropriate HTTP status codes
  - Ensure all requirements are met and documented
  - _Requirements: All requirements verification_