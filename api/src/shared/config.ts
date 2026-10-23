import z from 'zod'
import { config } from 'dotenv'

// Load local overrides when available; deployments can supply process.env directly.
config({
  path: '.env',
})

const envConfigSchema = z
  .object({
    // CORE SERVER, DATABASE & GENERAL SETTINGS
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.string().default('development'),
    DATABASE_URL: z.string(),
    SECRET_API_KEY: z.string(),
    WEB_APP_ORIGIN: z.string().url().optional(),
    TREKGO_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),

    //  LEADER VERIFICATION & CERTIFICATES
    LEADER_MAX_CERTIFICATES: z.coerce.number().int().min(1).max(100).default(10),
    LEADER_DOCUMENT_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),

    // SUPABASE & AUTHENTICATION (JWT)
    SUPABASE_URL: z.string(),
    SUPABASE_ANON_KEY: z.string(),
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    // Legacy JWT secrets (optional, for backward compatibility)
    ACCESS_TOKEN_SECRET: z.string().default(''),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_SECRET: z.string().default(''),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

    // MEDIA & CLOUDINARY CONFIGURATION
    // M0.1: Warn-only initialization if missing.
    // M0.2+: When Media is enabled, these must be strictly required (validated in superRefine)
    // to fail fast and prevent broken uploads. API secret MUST NEVER be exposed.
    MEDIA_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((val) => val === 'true'),
    MEDIA_DEV_UPLOAD_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((val) => val === 'true'),
    MEDIA_MAX_IMAGE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(20 * 1024 * 1024), // 20 MB
    MEDIA_MAX_VIDEO_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(100 * 1024 * 1024), // 100 MB
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

    // RENTAL (AREA B) CONFIGURATION & INTEGRATIONS
    // ID kho chính duy nhất (UUID) cho toàn bộ nghiệp vụ Rental (RB-POL-33)
    RENTAL_PRIMARY_INVENTORY_LOCATION_ID: z.string().uuid().optional(),
    // Secret HMAC-SHA256 (>= 16 ký tự) dùng để băm và xác thực mã OTP nhận hàng (PickupCode)
    RENTAL_PICKUP_CODE_SECRET: z.string().min(16).optional(),
    // Secret HMAC-SHA256 dùng để xác thực chữ ký công bố bằng chứng hư hỏng/khấu trừ từ Shared Media
    RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET: z.string().min(1).optional(),
    // API Key xác thực webhook/internal call giữa Area A và Area B
    RENTAL_INTEGRATION_API_KEY: z.string().optional(),
    // Timeout (ms) khi gọi HTTP sang Area A Internal Resolver
    RENTAL_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    // Các URL tích hợp nội bộ (tùy chọn khi tách service)
    AREA_A_INTERNAL_BASE_URL: z.string().url().optional(),
    RENTAL_PAYMENT_EVENTS_URL: z.string().url().optional(),
    RENTAL_NOTIFICATION_EVENTS_URL: z.string().url().optional(),
    RENTAL_AREA_A_EVENTS_URL: z.string().url().optional(),
    // Cấu hình sinh & lưu trữ tài liệu PDF mảng Rental (Hợp đồng, Biên lai, Phiếu kiểm tra)
    RENTAL_DOCUMENT_WORKER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((val) => val === 'true'),
    RENTAL_DOCUMENT_BUCKET: z.string().default('rental-documents'),
    RENTAL_PDF_FONT_PATH: z.string().optional(),

    // SHARED PAYMENTS, GATEWAYS (MOCK / VNPAY / MOMO) & WORKERS
    PAYMENT_PROVIDER: z.enum(['mock', 'momo', 'vnpay']).default('mock'),
    PAYMENT_PROVIDER_ENVIRONMENT: z.enum(['MOCK', 'SANDBOX', 'PRODUCTION']).default('MOCK'),
    // Danh sách các cổng thanh toán kích hoạt đồng thời (phân cách bằng dấu phẩy, vd: "mock,vnpay,momo")
    PAYMENT_ENABLED_PROVIDERS: z.string().default(''),

    // Mock Payment Gateway
    PAYMENT_MOCK_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((val) => val === 'true'),
    // Secret HMAC-SHA256 (>= 32 bytes) để ký và xác thực webhook của cổng Mock
    PAYMENT_MOCK_WEBHOOK_SECRET: z.string().min(32).optional(),

    // VNPay Sandbox Gateway
    VNPAY_SANDBOX_TMN_CODE: z
      .string()
      .regex(/^[A-Za-z0-9]{8}$/)
      .optional(),
    VNPAY_SANDBOX_HASH_SECRET: z.string().min(1).optional(),
    VNPAY_SANDBOX_RETURN_URL: z.string().url().optional(),
    VNPAY_SANDBOX_API_IP: z.string().min(1).optional(),
    // Sandbox Refund Simulation (TEST/DEMO only - strictly forbidden in production)
    PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((val) => val === 'true'),

    // MoMo Sandbox Gateway
    MOMO_SANDBOX_PARTNER_CODE: z.string().min(1).max(100).optional(),
    MOMO_SANDBOX_ACCESS_KEY: z.string().min(1).optional(),
    MOMO_SANDBOX_SECRET_KEY: z.string().min(1).optional(),
    MOMO_SANDBOX_IPN_URL: z.string().url().optional(),
    MOMO_SANDBOX_REDIRECT_URL: z.string().url().optional(),
    MOMO_SANDBOX_REQUEST_TYPE: z.enum(['captureWallet', 'payWithATM', 'payWithMethod']).default('captureWallet'),

    // Payment Recovery, Timeouts & Checkout TTL
    PAYMENT_PROVIDER_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(86400).default(35),
    PAYMENT_RECOVERY_LEASE_SECONDS: z.coerce.number().int().min(1).max(86400).default(120),
    PAYMENT_RECOVERY_RETRY_SECONDS: z.coerce.number().int().min(1).max(86400).default(30),
    PAYMENT_RECOVERY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(86400).default(8),
    PAYMENT_TRAIL_CHECKOUT_TTL_SECONDS: z.coerce.number().int().min(1).max(86400).default(900),

    // Background Workers (Payment Events, Technical Reversal, Deposit Refund, Recovery, Booking Expiry)
    PAYMENT_EVENTS_WORKER_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((val) => val === 'true'),
    PAYMENT_RECOVERY_WORKER_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((val) => val === 'true'),
    BOOKING_EXPIRY_WORKER_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((val) => val === 'true'),

    // MONGODB, REDIS & NOTIFICATIONS
    MONGODB_URI: z.string().default('mongodb://localhost:27017/vina_trekgo_notifications'),
    REDIS_URL: z.string(),
    REDIS_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true'),
    NOTIFICATION_CONSUMER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((val) => val === 'true'),

    // TEST DATABASE OVERRIDES (OPTIONAL)
    CF01_TEST_DATABASE_URL: z.string().optional(),
    CF02_TEST_DATABASE_URL: z.string().optional(),
    SF01_TEST_DATABASE_URL: z.string().optional(),
    PAYMENT_TEST_DATABASE_URL: z.string().optional(),
    AREAB_TEST_DATABASE_URL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.MEDIA_ENABLED) {
      if (!data.CLOUDINARY_CLOUD_NAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CLOUDINARY_CLOUD_NAME is required when MEDIA_ENABLED is true',
          path: ['CLOUDINARY_CLOUD_NAME'],
        })
      }
      if (!data.CLOUDINARY_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CLOUDINARY_API_KEY is required when MEDIA_ENABLED is true',
          path: ['CLOUDINARY_API_KEY'],
        })
      }
      if (!data.CLOUDINARY_API_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CLOUDINARY_API_SECRET is required when MEDIA_ENABLED is true',
          path: ['CLOUDINARY_API_SECRET'],
        })
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
