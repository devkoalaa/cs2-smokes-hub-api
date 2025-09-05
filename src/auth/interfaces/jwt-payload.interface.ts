export interface JwtPayload {
  sub: number; // User ID
  steamId: string;
  username: string;
  iat?: number; // Issued at
  exp?: number; // Expiration
}