import { UserRole, UserStatus } from '../constants'

export interface ActiveUserData {
  id: string
  authUserId: string
  email: string
  fullName?: string
  phone?: string | null
  cccd?: string | null
  role: UserRole | string
  status: UserStatus | string
  avatar?: string | null
}
