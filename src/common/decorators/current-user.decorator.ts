import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
}

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
}

/** Ambil user yang sedang login dari request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as AuthUser;
});
