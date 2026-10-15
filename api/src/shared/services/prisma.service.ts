import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    //Thêm cấu hình để kết nối database sử dụng pool cho Node.js version 20 
    const connectionString = `${process.env.DATABASE_URL}`
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    super({
      adapter,
      log: ['warn', 'error'],
    })
  }
  async onModuleInit() {
    await this.$connect()
  }
}
