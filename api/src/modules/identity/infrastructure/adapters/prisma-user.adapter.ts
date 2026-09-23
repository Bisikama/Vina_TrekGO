import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { IUserRepository } from '../../application/ports/user.port'
import { User } from '@prisma/client'

@Injectable()
export class PrismaUserAdapter implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    authUserId: string
    email: string
    fullName: string
    phone?: string
    cccd?: string
    avatar?: string
    role?: string
    status?: string
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        authUserId: data.authUserId,
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        cccd: data.cccd,
        avatar: data.avatar,
        role: data.role,
        status: data.status,
      },
    })
  }

  async findByAuthId(authUserId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { authUserId },
    })
  }

  async findByEmailOrAuthId(email: string, authUserId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ authUserId }, { email }],
      },
      include: {
        leaderProfile: true,
        userRank: true,
      },
    })
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        leaderProfile: true,
        userRank: true,
      },
    })
  }

  async deleteByAuthId(authUserId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { authUserId },
    })
  }
}
