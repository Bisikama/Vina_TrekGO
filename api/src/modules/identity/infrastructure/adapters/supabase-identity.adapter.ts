import { Injectable } from '@nestjs/common'
import { SupabaseService } from 'src/shared/services/supabase.service'
import {
  IIdentityProvider,
  IdentityUser,
  SessionData,
} from '../../application/ports/identity.port'

@Injectable()
export class SupabaseIdentityAdapter implements IIdentityProvider {
  constructor(private readonly supabase: SupabaseService) {}

  async createUser(params: {
    email: string
    password?: string
    fullName?: string
    phone?: string
  }): Promise<IdentityUser> {
    const user = await this.supabase.createUser(params)
    return {
      id: user.id,
      email: user.email,
    }
  }

  async deleteUser(authUserId: string): Promise<void> {
    await this.supabase.deleteUser(authUserId)
  }

  async signInWithPassword(
    email: string,
    password?: string,
  ): Promise<{ user: IdentityUser; session: SessionData }> {
    const data = await this.supabase.signInWithPassword(email, password || '')
    
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at,
        tokenType: data.session.token_type,
      },
    }
  }

  async refreshSession(refreshToken: string): Promise<SessionData> {
    const session = await this.supabase.refreshSession(refreshToken)
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      expiresAt: session.expires_at,
      tokenType: session.token_type,
    }
  }

  async signOut(accessToken?: string): Promise<void> {
    await this.supabase.signOut(accessToken)
  }
}
