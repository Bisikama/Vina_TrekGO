import z from 'zod'
import { config } from 'dotenv'

// Load local overrides when available; deployments can supply process.env directly.
config({
  path: '.env',
})

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
  MEDIA_DEV_UPLOAD_ENABLED: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
  MEDIA_MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024), // 20 MB
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024), // 100 MB
  MEDIA_PROVENANCE_TIME_TOLERANCE_MINUTES: z.coerce.number().int().nonnegative().default(30),
  
  MEDIA_PROVIDER: z.literal('CLOUDINARY').default('CLOUDINARY'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_SIGNATURE_ALGORITHM: z.literal('sha256').default('sha256'),
  
  MEDIA_PENDING_UPLOAD_RETENTION_HOURS: z.coerce.number().int().positive().default(24),
  MEDIA_REJECTED_RETENTION_HOURS: z.coerce.number().int().positive().default(48),
  MEDIA_CATALOG_ORPHAN_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  MEDIA_EVIDENCE_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  MEDIA_CLEANUP_BATCH_SIZE: z.coerce.number().int().positive().default(100),

  // M0.3 Validation configurations
  MEDIA_IMAGE_MIN_WIDTH: z.coerce.number().int().positive().default(320),
  MEDIA_IMAGE_MIN_HEIGHT: z.coerce.number().int().positive().default(320),
  MEDIA_IMAGE_MAX_WIDTH: z.coerce.number().int().positive().default(12000),
  MEDIA_IMAGE_MAX_HEIGHT: z.coerce.number().int().positive().default(12000),
  MEDIA_VIDEO_MAX_DURATION_SECONDS: z.coerce.number().int().positive().default(120),
  MEDIA_VIDEO_MIN_WIDTH: z.coerce.number().int().positive().default(320),
  MEDIA_VIDEO_MIN_HEIGHT: z.coerce.number().int().positive().default(240),
  MEDIA_VIDEO_MAX_WIDTH: z.coerce.number().int().positive().default(7680),
  MEDIA_VIDEO_MAX_HEIGHT: z.coerce.number().int().positive().default(4320),

  //Mongo
  MONGODB_URI: z.string().default('mongodb://localhost:27017/vina_trekgo_notifications'),

  //Notification
  NOTIFICATION_CONSUMER_ENABLED: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
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
  console.error('Các biến môi trường cấu hình không hợp lệ:', configserver.error.format())
  process.exit(1)
}


const envconfig = configserver.data

export default envconfig
