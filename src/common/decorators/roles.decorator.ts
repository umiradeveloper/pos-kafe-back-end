import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Batasi endpoint hanya untuk role tertentu. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Singkatan: hanya OWNER dan ADMIN. */
export const ManagerOnly = () => Roles(Role.OWNER, Role.ADMIN);
