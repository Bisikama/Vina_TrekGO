import 'dotenv/config'
import { PrismaClient, UserRole, UserStatus } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

export interface UserSeedItem {
  id: string
  auth_user_id: string
  email: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
  encrypted_password?: string
}

export async function seedUsersData(prismaClient: PrismaClient = prisma) {
  console.log('🌱 Bắt đầu nạp seed data Users...')

  const dataPath = path.join(__dirname, 'seeds', 'data', 'users.seed.json')
  const rawData = fs.readFileSync(dataPath, 'utf8')
  const users: UserSeedItem[] = JSON.parse(rawData)

  for (const u of users) {
    // 1. Đồng bộ auth.users (nếu DB hỗ trợ và có password hash để Supabase Auth có thể login)
    if (u.encrypted_password) {
      try {
        await prismaClient.$executeRawUnsafe(`
          INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            aud,
            role,
            created_at,
            updated_at,
            is_super_admin,
            is_sso_user,
            is_anonymous
          ) VALUES (
            $1::uuid,
            '00000000-0000-0000-0000-000000000000'::uuid,
            $2,
            $3,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            json_build_object('sub', $1, 'email', $2, 'phone', $4, 'full_name', $5, 'email_verified', true, 'phone_verified', false)::jsonb,
            'authenticated',
            'authenticated',
            $6::timestamptz,
            $7::timestamptz,
            false,
            false,
            false
          )
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            encrypted_password = EXCLUDED.encrypted_password,
            raw_user_meta_data = EXCLUDED.raw_user_meta_data,
            updated_at = NOW();
        `, u.auth_user_id, u.email, u.encrypted_password, u.phone, u.full_name, u.created_at, u.updated_at)
      } catch (authErr: any) {
        // Nếu không có quyền ghi auth.users hoặc bảng không tồn tại, bỏ qua nhẹ nhàng
      }
    }

    // 2. Upsert public.users
    await prismaClient.user.upsert({
      where: { id: u.id },
      update: {
        authUserId: u.auth_user_id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        avatarUrl: u.avatar_url,
        role: u.role,
        status: u.status,
      },
      create: {
        id: u.id,
        authUserId: u.auth_user_id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        avatarUrl: u.avatar_url,
        role: u.role,
        status: u.status,
      },
    })

    console.log(`✅ [${u.role}] ${u.email} (${u.full_name})`)
  }

  console.log(`🎉 Đã nạp thành công ${users.length} Users!`)
}

if (require.main === module) {
  seedUsersData()
    .catch((e) => {
      console.error('❌ Lỗi seed users:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
