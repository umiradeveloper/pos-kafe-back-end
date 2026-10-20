import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

const publicFields = {
  id: true,
  name: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ select: publicFields, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    this.assertCanManageRole(actor, dto.role);
    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        username: dto.username.trim().toLowerCase(),
        password: await bcrypt.hash(dto.password, 10),
        role: dto.role,
      },
      select: publicFields,
    });
  }

  async update(actor: AuthUser, id: number, dto: UpdateUserDto) {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    this.assertCanManageRole(actor, target.role);
    if (dto.role) this.assertCanManageRole(actor, dto.role);

    if (actor.id === id && (dto.isActive === false || (dto.role && dto.role !== target.role))) {
      throw new BadRequestException('Anda tidak bisa menonaktifkan atau mengubah role akun sendiri');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        role: dto.role,
        isActive: dto.isActive,
        password: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
      },
      select: publicFields,
    });
  }

  /** Admin tidak boleh membuat atau mengubah akun Owner. */
  private assertCanManageRole(actor: AuthUser, role: Role) {
    if (actor.role !== Role.OWNER && role === Role.OWNER) {
      throw new ForbiddenException('Hanya Owner yang bisa mengelola akun Owner');
    }
  }
}
