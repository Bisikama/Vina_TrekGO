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
  ACCESS_TOKEN_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  SECRET_API_KEY: z.string(),
})

const configserver = envConfigSchema.safeParse(process.env)
if (!configserver.success) {
  console.error('Các giá trị khai báo trong .env không hợp lệ:', configserver.error.format())
  process.exit(1)
}


const envconfig = configserver.data

export default envconfig
