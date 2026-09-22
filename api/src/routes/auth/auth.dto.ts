import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { z } from 'zod'
import { UserRole } from 'src/shared/constants'

// ==========================================
// 1. REGISTER SCHEMA & DTO
// ==========================================
export const RegisterSchema = z.object({
  email: z.string().trim().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  fullName: z.string().trim().min(2, 'Họ và tên phải có ít nhất 2 ký tự').optional(),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ (10 chữ số bắt đầu bằng 0 hoặc +84)')
    .optional()
    .nullable(),
  cccd: z
    .string()
    .trim()
    .regex(/^[0-9]{12}$/, 'CCCD phải gồm đúng 12 chữ số')
    .optional()
    .nullable(),
  avatar: z.string().trim().url('Đường dẫn ảnh đại diện không hợp lệ').optional().nullable(),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
})

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email người dùng',
  })
  email!: string

  @ApiProperty({
    example: 'SecretPassword123@',
    description: 'Mật khẩu (ít nhất 6 ký tự)',
  })
  password!: string

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên đầy đủ',
  })
  fullName?: string

  @ApiPropertyOptional({
    example: '0987654321',
    description: 'Số điện thoại (10 chữ số)',
  })
  phone?: string

  @ApiPropertyOptional({
    example: '012345678901',
    description: 'Căn cước công dân (12 chữ số)',
  })
  cccd?: string

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'Đường dẫn ảnh đại diện',
  })
  avatar?: string

  @ApiPropertyOptional({
    enum: UserRole,
    default: UserRole.USER,
    description: 'Vai trò (USER, LEADER, ADMIN, STAFF_WAREHOUSE, STAFF_LOGISTICS)',
  })
  role?: UserRole
}

// ==========================================
// 2. LOGIN SCHEMA & DTO
// ==========================================
export const LoginSchema = z.object({
  email: z.string().trim().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
})

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email người dùng',
  })
  email!: string

  @ApiProperty({
    example: 'SecretPassword123@',
    description: 'Mật khẩu',
  })
  password!: string
}

// ==========================================
// 3. REFRESH TOKEN SCHEMA & DTO
// ==========================================
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token là bắt buộc'),
})

export class RefreshTokenDto {
  @ApiProperty({
    example: 'your_refresh_token_here',
    description: 'Chuỗi refresh token của Supabase',
  })
  refreshToken!: string
}

// ==========================================
// 4. LOGOUT SCHEMA & DTO
// ==========================================
export const LogoutSchema = z.object({
  refreshToken: z.string().trim().optional(),
})

export class LogoutDto {
  @ApiPropertyOptional({
    example: 'your_refresh_token_here',
    description: 'Chuỗi refresh token (tùy chọn)',
  })
  refreshToken?: string
}

// ==========================================
// 5. BOOTSTRAP SCHEMA & DTO
// ==========================================
export const BootstrapSchema = z.object({
  authUserId: z.string().trim().uuid('authUserId phải là định dạng UUID hợp lệ từ Supabase'),
  email: z.string().trim().email('Email không đúng định dạng'),
  fullName: z.string().trim().optional(),
  phone: z.string().trim().optional().nullable(),
  cccd: z.string().trim().optional().nullable(),
  avatar: z.string().trim().optional().nullable(),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
})

export class BootstrapDto {
  @ApiProperty({
    example: 'c248b111-c917-48f0-b9bb-811c750e9391',
    description: 'Supabase User UID (auth.users.id)',
  })
  authUserId!: string

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email người dùng đã đăng ký qua Supabase',
  })
  email!: string

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên người dùng',
  })
  fullName?: string

  @ApiPropertyOptional({
    example: '0987654321',
    description: 'Số điện thoại',
  })
  phone?: string

  @ApiPropertyOptional({
    example: '012345678901',
    description: 'Căn cước công dân (12 chữ số)',
  })
  cccd?: string

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'Đường dẫn ảnh đại diện',
  })
  avatar?: string

  @ApiPropertyOptional({
    enum: UserRole,
    default: UserRole.USER,
    description: 'Vai trò trong TrekGo',
  })
  role?: UserRole
}


