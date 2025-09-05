# Requirements Document

## Introduction

The CS2 Smokes Hub is a RESTful API application built with NestJS that allows Counter-Strike 2 players to share, rate, and manage smoke grenade strategies on different maps. The system provides Steam authentication, user management, smoke sharing capabilities, rating system, and content moderation through reports.

## Requirements

### Requirement 1

**User Story:** As a CS2 player, I want to authenticate using my Steam account, so that I can access the platform with my existing gaming identity.

#### Acceptance Criteria

1. WHEN a user visits /auth/steam THEN the system SHALL redirect them to Steam's authentication page
2. WHEN Steam returns user data to /auth/steam/return THEN the system SHALL create a new user if the steamId doesn't exist
3. WHEN Steam returns user data to /auth/steam/return THEN the system SHALL generate and return a JWT token containing the userId
4. WHEN a user provides a valid JWT token to /auth/me THEN the system SHALL return their complete user profile data
5. IF a user already exists with the same steamId THEN the system SHALL update their profile information and return a JWT token

### Requirement 2

**User Story:** As a CS2 player, I want to view available maps, so that I can browse smoke strategies for specific maps I play.

#### Acceptance Criteria

1. WHEN a user requests GET /maps THEN the system SHALL return a list of all available maps with id, name, and imageUrl
2. WHEN a user requests GET /maps/:id with a valid map ID THEN the system SHALL return the complete map details
3. WHEN a user requests GET /maps/:id with an invalid map ID THEN the system SHALL return a 404 error

### Requirement 3

**User Story:** As a CS2 player, I want to view smoke strategies for a specific map, so that I can learn new techniques and see community ratings.

#### Acceptance Criteria

1. WHEN a user requests GET /maps/:mapId/smokes THEN the system SHALL return all smokes for that map
2. WHEN returning smoke data THEN the system SHALL include a calculated score field representing the sum of all rating values
3. WHEN returning smoke data THEN the system SHALL include smoke details: id, title, videoUrl, timestamp, coordinates, author information, and creation date
4. WHEN a user requests smokes for an invalid mapId THEN the system SHALL return a 404 error

### Requirement 4

**User Story:** As an authenticated CS2 player, I want to share my smoke strategies, so that I can contribute to the community knowledge base.

#### Acceptance Criteria

1. WHEN an authenticated user posts to /smokes with valid data THEN the system SHALL create a new smoke entry
2. WHEN creating a smoke THEN the system SHALL validate required fields: title, videoUrl, timestamp, x_coord, y_coord, mapId
3. WHEN creating a smoke THEN the system SHALL automatically set the authorId from the authenticated user's JWT
4. WHEN an unauthenticated user attempts to create a smoke THEN the system SHALL return a 401 unauthorized error
5. WHEN invalid data is provided THEN the system SHALL return validation errors with specific field requirements

### Requirement 5

**User Story:** As an authenticated CS2 player, I want to delete my own smoke strategies, so that I can remove outdated or incorrect content.

#### Acceptance Criteria

1. WHEN an authenticated user requests DELETE /smokes/:id for their own smoke THEN the system SHALL delete the smoke and return success
2. WHEN an authenticated user attempts to delete another user's smoke THEN the system SHALL return a 403 forbidden error
3. WHEN a user attempts to delete a non-existent smoke THEN the system SHALL return a 404 error
4. WHEN an unauthenticated user attempts to delete a smoke THEN the system SHALL return a 401 unauthorized error

### Requirement 6

**User Story:** As an authenticated CS2 player, I want to rate smoke strategies, so that I can help the community identify the most effective techniques.

#### Acceptance Criteria

1. WHEN an authenticated user posts to /smokes/:smokeId/rate with value 1 or -1 THEN the system SHALL create or update their rating
2. WHEN a user changes their existing rating THEN the system SHALL update the previous rating instead of creating a duplicate
3. WHEN a user provides an invalid rating value THEN the system SHALL return a validation error
4. WHEN a user attempts to rate a non-existent smoke THEN the system SHALL return a 404 error
5. WHEN an unauthenticated user attempts to rate a smoke THEN the system SHALL return a 401 unauthorized error

### Requirement 7

**User Story:** As an authenticated CS2 player, I want to report inappropriate smoke content, so that I can help maintain community standards.

#### Acceptance Criteria

1. WHEN an authenticated user posts to /smokes/:smokeId/report with a reason THEN the system SHALL create a new report with PENDING status
2. WHEN creating a report THEN the system SHALL validate that a reason is provided
3. WHEN creating a report THEN the system SHALL automatically set the reporterId from the authenticated user's JWT
4. WHEN a user attempts to report a non-existent smoke THEN the system SHALL return a 404 error
5. WHEN an unauthenticated user attempts to report a smoke THEN the system SHALL return a 401 unauthorized error

### Requirement 8

**User Story:** As a system administrator, I want the API to use PostgreSQL with Prisma ORM, so that data is stored reliably and efficiently with type-safe database operations.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL connect to PostgreSQL using the DATABASE_URL environment variable
2. WHEN performing database operations THEN the system SHALL use Prisma Client for all data access
3. WHEN the database schema changes THEN the system SHALL support Prisma migrations
4. WHEN database operations fail THEN the system SHALL handle errors gracefully and return appropriate HTTP status codes

### Requirement 9

**User Story:** As a system administrator, I want JWT-based session management, so that the API can securely authenticate users across requests.

#### Acceptance Criteria

1. WHEN generating JWT tokens THEN the system SHALL use the JWT_SECRET environment variable
2. WHEN validating JWT tokens THEN the system SHALL verify token signature and expiration
3. WHEN a JWT token is invalid or expired THEN the system SHALL return a 401 unauthorized error
4. WHEN protecting routes THEN the system SHALL use JwtAuthGuard to enforce authentication requirements

### Requirement 10

**User Story:** As a developer, I want comprehensive input validation, so that the API handles malformed requests gracefully and provides clear error messages.

#### Acceptance Criteria

1. WHEN receiving API requests THEN the system SHALL validate all input using DTOs with class-validator
2. WHEN validation fails THEN the system SHALL return detailed error messages indicating which fields are invalid
3. WHEN required fields are missing THEN the system SHALL return specific error messages for each missing field
4. WHEN data types are incorrect THEN the system SHALL return type validation errors
5. WHEN coordinate values are provided THEN the system SHALL validate they are valid floating-point numbers