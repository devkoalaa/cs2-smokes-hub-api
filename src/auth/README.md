# Authentication Module

This module provides JWT-based authentication infrastructure for the CS2 Smokes Hub API.

## Components

### JwtStrategy
- Validates JWT tokens using Passport
- Extracts user information from the database
- Configured with JWT_SECRET from environment variables

### JwtAuthGuard
- Protects routes requiring authentication
- Returns 401 Unauthorized for invalid/missing tokens
- Can be applied to controllers or individual routes

### JwtPayload Interface
- Defines the structure of JWT token payload
- Contains user ID, Steam ID, and username

## Usage

### Protecting Routes

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, GetUser } from '../auth';

@Controller('protected')
export class ProtectedController {
  @Get('data')
  @UseGuards(JwtAuthGuard)
  getProtectedData(@GetUser() user: any) {
    return { message: 'Protected data', userId: user.id };
  }
}
```

### JWT Token Format

The JWT payload contains:
```typescript
{
  sub: number;      // User ID
  steamId: string;  // Steam ID
  username: string; // Steam username
  iat: number;      // Issued at timestamp
  exp: number;      // Expiration timestamp
}
```

### Configuration

The module requires the following environment variables:
- `JWT_SECRET`: Secret key for signing JWT tokens
- Token expiration is set to 24 hours by default

## Testing

All components include comprehensive unit tests:
- `jwt.strategy.spec.ts`: Tests JWT validation logic
- `jwt-auth.guard.spec.ts`: Tests guard behavior
- `auth.module.spec.ts`: Tests module configuration

## Requirements Satisfied

This implementation satisfies the following requirements:
- **9.1**: JWT tokens use JWT_SECRET environment variable
- **9.2**: JWT tokens are validated for signature and expiration
- **9.3**: Invalid/expired tokens return 401 Unauthorized
- **9.4**: JwtAuthGuard enforces authentication requirements on protected routes