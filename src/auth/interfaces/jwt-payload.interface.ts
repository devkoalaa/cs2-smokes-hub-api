export interface JwtPayload {
  sub: number;
  steamId: string;
  username: string;
  iat?: number;
  exp?: number;
}