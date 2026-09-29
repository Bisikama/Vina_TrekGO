import z from 'zod'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'

// Kiểm tra file .env có tồn tại hay không
config({
  path: '.env',
})

if (!fs.existsSync(path.resolve('.env'))) {
  console.log('Không tìm thấy file env')
  process.exit(1)
}

const envConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string(),
  SECRET_API_KEY: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  // Legacy JWT secrets (optional, for backward compatibility)
  ACCESS_TOKEN_SECRET: z.string().default(''),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().default(''),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  // CLOUDINARY CONFIG SAFETY
  // M0.1: Warn-only initialization if missing.
  // M0.2+: When Media is enabled, these must be strictly required (remove .optional())
  // to fail fast and prevent broken uploads. API secret MUST NEVER be exposed.
  MEDIA_ENABLED: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
  MEDIA_MAX_IMAGE_BYTES: z.coerce.number().default(20 * 1024 * 1024), // 20 MB
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().default(100 * 1024 * 1024), // 100 MB
  
  MEDIA_PROVIDER: z.literal('CLOUDINARY').default('CLOUDINARY'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_SIGNATURE_ALGORITHM: z.literal('sha256').default('sha256'),
})
.superRefine((data, ctx) => {
  if (data.MEDIA_ENABLED) {
    if (!data.CLOUDINARY_CLOUD_NAME) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CLOUDINARY_CLOUD_NAME is required when MEDIA_ENABLED is true', path: ['CLOUDINARY_CLOUD_NAME'] });
    }
    if (!data.CLOUDINARY_API_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CLOUDINARY_API_KEY is required when MEDIA_ENABLED is true', path: ['CLOUDINARY_API_KEY'] });
    }
    if (!data.CLOUDINARY_API_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CLOUDINARY_API_SECRET is required when MEDIA_ENABLED is true', path: ['CLOUDINARY_API_SECRET'] });
    }
  }
})


const configserver = envConfigSchema.safeParse(process.env)
if (!configserver.success) {
  console.error('Các giá trị khai báo trong .env không hợp lệ:', configserver.error.format())
  process.exit(1)
}


const envconfig = configserver.data

export default envconfig
