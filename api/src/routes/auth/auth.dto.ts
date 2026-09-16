import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from 'src/shared/constants'

export class RegisterDto {
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

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Họ và tên đầy đủ',
  })
  fullName?: string

  @ApiPropertyOptional({
    example: '0987654321',
    description: 'Số điện thoại',
  })
  phone?: string

  @ApiPropertyOptional({
    example: '012345678901',
    description: 'Căn cước công dân',
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
    description: 'Vai trò (USER, LEADER, ADMIN, STAFF)',
  })
  role?: UserRole
}

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

export class RefreshTokenDto {
  @ApiProperty({
    example: 'your_refresh_token_here',
    description: 'Chuỗi refresh token',
  })
  refreshToken!: string
}

export class LogoutDto {
  @ApiProperty({
    example: 'your_refresh_token_here',
    description: 'Chuỗi refresh token cần thu hồi',
  })
  refreshToken!: string
}
