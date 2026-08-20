import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import * as usersMapper from './users.mapper';
import type { MeProfile, PublicProfile } from './users.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    await this.findByIdOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name, tagline: dto.tagline },
    });
  }

  async updateSettings(id: string, dto: UpdateSettingsDto): Promise<User> {
    await this.findByIdOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        quietHours: dto.quietHours,
        showPresence: dto.showPresence,
        allowStrangerInvites: dto.allowStrangerInvites,
        morningDigest: dto.morningDigest,
      },
    });
  }

  toPublicProfile(user: User): PublicProfile {
    return usersMapper.toPublicProfile(user);
  }

  toMeProfile(user: User): MeProfile {
    return usersMapper.toMeProfile(user);
  }
}
