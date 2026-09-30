import { User, UserRole, UserStatus } from '@prisma/client'

export const I_USER_REPOSITORY = 'I_USER_REPOSITORY'

export interface IUserRepository {
  create(data: {
    authUserId: string
    email: string
    fullName: string
    phone?: string
    avatar?: string
    avatarUrl?: string
    role?: UserRole
    status?: UserStatus
  }): Promise<User>

  findByAuthId(authUserId: string): Promise<User | null>

  findByEmailOrAuthId(email: string, authUserId: string): Promise<User | null>

  findById(id: string): Promise<User | null>

  deleteByAuthId(authUserId: string): Promise<void>

  findByEmail(email: string): Promise<User | null>
}
