export const I_IDENTITY_PROVIDER = 'I_IDENTITY_PROVIDER'

export interface IdentityUser {
  id: string
  email?: string
}

export interface SessionData {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt?: number
  tokenType: string
}

export interface IIdentityProvider {
  createUser(params: {
    email: string
    password?: string
    fullName?: string
    phone?: string
  }): Promise<IdentityUser>

  deleteUser(authUserId: string): Promise<void>

  signInWithPassword(
    email: string,
    password?: string,
  ): Promise<{ user: IdentityUser; session: SessionData }>

  refreshSession(refreshToken: string): Promise<SessionData>

  signOut(accessToken?: string): Promise<void>
}
