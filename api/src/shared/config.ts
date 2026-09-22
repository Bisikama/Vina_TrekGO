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
})


const configserver = envConfigSchema.safeParse(process.env)
if (!configserver.success) {
  console.error('Các giá trị khai báo trong .env không hợp lệ:', configserver.error.format())
  process.exit(1)
}


const envconfig = configserver.data

export default envconfig
