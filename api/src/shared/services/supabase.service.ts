import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import envConfig from '../config'
import * as WebSocket from 'ws'

//Polyfill bằng thư viện ws - Để có thể sử dụng NodeJS-V20
if (typeof globalThis.WebSocket === 'undefined') {
  ;(globalThis as any).WebSocket = WebSocket
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name)
  private supabaseClient: SupabaseClient | null = null
  private adminClient: SupabaseClient | null = null

  constructor() {
    let supabaseUrl = envConfig.SUPABASE_URL?.trim()
    let serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY?.trim()
    let anonKey = envConfig.SUPABASE_ANON_KEY?.trim()

    // Đọc trực tiếp từ file .env để luôn cập nhật giá trị mới nhất khi hot-reload
    try {
      const envPath = path.resolve('.env')
      if (fs.existsSync(envPath)) {
        const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf-8'))
        if (parsed.SUPABASE_URL) supabaseUrl = parsed.SUPABASE_URL.trim()
        if (parsed.SUPABASE_SERVICE_ROLE_KEY) serviceKey = parsed.SUPABASE_SERVICE_ROLE_KEY.trim()
        if (parsed.SUPABASE_ANON_KEY) anonKey = parsed.SUPABASE_ANON_KEY.trim()
      }
    } catch {
      // Fallback to envConfig
    }

    if (supabaseUrl) {
      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
    }

    if (supabaseUrl && (serviceKey || anonKey)) {
      if (serviceKey) {
        this.adminClient = createClient(supabaseUrl, serviceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      }

      this.supabaseClient = createClient(supabaseUrl, (serviceKey || anonKey)!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
      this.logger.log('Supabase Client initialized successfully')
    } else {
      this.logger.warn(
        'SUPABASE_URL or keys not provided in .env. Supabase integration running in mock/offline mode.',
      )
    }
  }

  isConfigured(): boolean {
    return !!this.supabaseClient
  }

  /**
   * Lấy client của Supabase
   */
  getClient(): SupabaseClient {
    if (!this.supabaseClient) {
      throw new UnauthorizedException('Supabase chưa được cấu hình (thiếu SUPABASE_URL / KEY)')
    }
    return this.supabaseClient
  }

  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      return this.getClient()
    }
    return this.adminClient
  }

  /**
   * Tạo user mới trên Supabase Auth (dùng cho backend register)
   */
  async createUser(params: {
    email: string
    password?: string
    fullName?: string
    phone?: string
  }): Promise<SupabaseUser> {
    if (!this.supabaseClient) {
      throw new BadRequestException('Supabase chưa được cấu hình')
    }

    // Ưu tiên dùng Admin API để auto-confirm email, giúp test Swagger/API ngay lập tức
    if (this.adminClient) {
      const { data, error } = await this.adminClient.auth.admin.createUser({
        email: params.email,
        password: params.password || 'TrekGo@123456',
        email_confirm: true,
        user_metadata: {
          full_name: params.fullName,
          phone: params.phone,
        },
      })

      if (error) {
        this.logger.error(`Supabase admin.createUser error: ${error.message}`)
        if (
          error.message.toLowerCase().includes('already') ||
          error.status === 422 ||
          error.code === 'email_exists'
        ) {
          throw new ConflictException('Email này đã tồn tại trên Supabase')
        }
        throw new BadRequestException(`Lỗi tạo tài khoản Supabase: ${error.message}`)
      }

      if (!data.user) {
        throw new BadRequestException('Không thể tạo tài khoản trên Supabase')
      }

      return data.user
    }

    // Fallback sang signUp
    const { data, error } = await this.supabaseClient.auth.signUp({
      email: params.email,
      password: params.password || 'TrekGo@123456',
      options: {
        data: {
          full_name: params.fullName,
          phone: params.phone,
        },
      },
    })

    if (error) {
      this.logger.error(`Supabase signUp error: ${error.message}`)
      if (error.message.toLowerCase().includes('already')) {
        throw new ConflictException('Email này đã tồn tại trên Supabase')
      }
      throw new BadRequestException(`Lỗi đăng ký Supabase: ${error.message}`)
    }

    if (!data.user) {
      throw new BadRequestException('Không thể tạo tài khoản trên Supabase')
    }

    return data.user
  }
    /**
   * Đăng ký tài khoản mới & gửi mã OTP về Email
   */
  async signUp(params: {
    email: string
    password?: string
    fullName?: string
    phone?: string
  }): Promise<SupabaseUser> {
    const client = this.getClient()

    const { data, error } = await client.auth.signUp({
      email: params.email,
      password: params.password || 'TrekGo@123456',
      options: {
        data: {
          full_name: params.fullName,
          phone: params.phone,
        },
      },
    })

    if (error) {
      this.logger.error(`Supabase signUp error: ${error.message}`)
      if (error.message.toLowerCase().includes('already')) {
        throw new ConflictException('Email này đã tồn tại trên Supabase')
      }
      throw new BadRequestException(`Lỗi đăng ký Supabase: ${error.message}`)
    }

    if (!data.user) {
      throw new BadRequestException('Không thể tạo tài khoản trên Supabase')
    }
    // Nếu email đã tồn tại và đã được kích hoạt, Supabase sẽ trả về identities rỗng
    if (data.user.identities && data.user.identities.length === 0) {
      throw new ConflictException('Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.')
    }

    return data.user
  }


  /**
   * Xóa user trên Supabase (Rollback khi tạo profile Postgres thất bại)
   */
  async deleteUser(authUserId: string): Promise<void> {
    if (this.adminClient) {
      try {
        await this.adminClient.auth.admin.deleteUser(authUserId)
      } catch (err) {
        this.logger.warn(`Rollback delete user failed: ${authUserId}`, err)
      }
    }
  }

  /**
   * Đăng nhập qua Supabase bằng email & password
   */
  async signInWithPassword(email: string, password: string) {
    const client = this.getClient()
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      this.logger.warn(`Supabase signIn error: ${error.message}`)
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác')
    }

    return data
  }

  /**
   * Làm mới session bằng refresh_token qua Supabase Auth
   */
  async refreshSession(refreshToken: string) {
    const client = this.getClient()
    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session) {
      this.logger.warn(`Supabase refreshSession error: ${error?.message}`)
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn trên Supabase')
    }

    return data.session
  }

    /**
   * Đăng xuất trên Supabase: Thu hồi token/session của user
   */
  async signOut(accessToken?: string): Promise<void> {
    if (!accessToken) return

    try {
      if (this.adminClient) {
        // Thu hồi toàn bộ refresh token của user trên Supabase
        const { error } = await this.adminClient.auth.admin.signOut(accessToken)
        if (error) {
          this.logger.warn(`Supabase admin.signOut error: ${error.message}`)
        }
      }
    } catch (err) {
      this.logger.warn('Supabase signOut error', err)
    }
  }


  /**
   * Xác thực Supabase Access Token (JWT) từ client gửi lên
   * Trả về thông tin Supabase User nếu token hợp lệ
   */
  async verifyToken(token: string): Promise<SupabaseUser> {
    if (!this.supabaseClient) {
      throw new UnauthorizedException('Supabase Client chưa được khởi tạo')
    }

    const {
      data: { user },
      error,
    } = await this.supabaseClient.auth.getUser(token)

    if (error || !user) {
      this.logger.error(`Supabase token verification failed: ${error?.message}`)
      throw new UnauthorizedException('Token Supabase không hợp lệ hoặc đã hết hạn')
    }

    return user
  }

  async resetPasswordForEmail(email: string, redirectTo?: string): Promise<void> {
    const client = this.getClient()

    // Config redirect url - nếu không có thì dùng default url
    const { data, error } = await client.auth.resetPasswordForEmail(email,{redirectTo})

    if (error) {
      this.logger.error(`Supabase resetPassword error: ${error.message}`)
      throw new BadRequestException(`Lỗi gửi email reset mật khẩu: ${error.message}`)
    }

    // Optionally return something, but usually void or a confirmation
  }
    /**
   * Xác thực mã OTP người dùng nhập
   */
    async verifyOtp(email: string, token: string) {
    const client = this.getClient()

    const { data, error } = await client.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    })

    if (error) {
      this.logger.error(`Supabase verifyOtp error: ${error.message}`)
      throw new BadRequestException(`Mã OTP không hợp lệ hoặc đã hết hạn: ${error.message}`)
    }

    // Đảm bảo trả về user và session không null
    if (!data.user || !data.session) {
      throw new BadRequestException('Không tìm thấy thông tin phiên đăng nhập sau khi xác thực OTP')
    }

    return {
      user: data.user,
      session: data.session,
    }
  }
    /**
   * Gửi lại mã OTP qua email (Resend OTP)
   */
    async resendOtp(email: string) {
    const client = this.getClient()

    const { data, error } = await client.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      this.logger.error(`Supabase resendOtp error: ${error.message}`)

      // 👉 Bắt lỗi spam gửi liên tục từ Supabase:
      if (
        error.status === 429 ||
        error.code === 'over_email_send_rate_limit' ||
        error.message.toLowerCase().includes('rate limit') ||
        error.message.toLowerCase().includes('security purposes')
      ) {
        throw new HttpException(
          'Bạn đang thao tác quá nhanh. Vui lòng đợi 60 giây trước khi yêu cầu gửi lại mã mới.',
          HttpStatus.TOO_MANY_REQUESTS, // Trả về HTTP 429
        )
      }

      throw new BadRequestException(`Lỗi gửi lại mã OTP: ${error.message}`)
    }

    return data
  }



}


