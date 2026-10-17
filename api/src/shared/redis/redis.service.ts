import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import Redis from 'ioredis'
import envConfig from '../config'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: Redis | null = null
  private isConnected = false
  private readonly memoryCache = new Map<string, { value: Buffer | string; expiresAt: number | null }>()
  private readonly MAX_MEMORY_CACHE_ITEMS = 1000

  async onModuleInit() {
    if (!envConfig.REDIS_ENABLED) {
      this.logger.log('Redis is disabled by configuration (REDIS_ENABLED=false). Using in-memory fallback cache.')
      return
    }

    try {
      this.client = new Redis(envConfig.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('Redis connection retry limit reached. Falling back to memory cache.')
            return null
          }
          return Math.min(times * 200, 1000)
        },
        lazyConnect: true,
      })

      this.client.on('connect', () => {
        this.isConnected = true
        this.logger.log('Connected to Redis server successfully.')
      })

      this.client.on('error', (err) => {
        this.isConnected = false
        this.logger.warn(`Redis connection error: ${err.message}. Operations will fallback to memory cache.`)
      })

      await this.client.connect()
    } catch (err: any) {
      this.logger.warn(`Could not connect to Redis: ${err.message}. Fallback to memory cache.`)
      this.isConnected = false
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit()
      } catch {
        // ignore disconnect errors
      }
    }
  }

  get isRedisConnected(): boolean {
    return this.isConnected && this.client !== null
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    if (this.isRedisConnected && this.client) {
      try {
        return await this.client.getBuffer(key)
      } catch (err: any) {
        this.logger.warn(`Redis getBuffer error for key ${key}: ${err.message}`)
      }
    }

    const item = this.memoryCache.get(key)
    if (!item) return null
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryCache.delete(key)
      return null
    }
    return Buffer.isBuffer(item.value) ? item.value : Buffer.from(item.value)
  }

  async setBuffer(key: string, value: Buffer, ttlSeconds = 86400): Promise<void> {
    if (this.isRedisConnected && this.client) {
      try {
        await this.client.set(key, value, 'EX', ttlSeconds)
        return
      } catch (err: any) {
        this.logger.warn(`Redis setBuffer error for key ${key}: ${err.message}`)
      }
    }

    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_ITEMS) {
      const firstKey = this.memoryCache.keys().next().value
      if (firstKey) this.memoryCache.delete(firstKey)
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    })
  }

  async get(key: string): Promise<string | null> {
    if (this.isRedisConnected && this.client) {
      try {
        return await this.client.get(key)
      } catch (err: any) {
        this.logger.warn(`Redis get error for key ${key}: ${err.message}`)
      }
    }

    const item = this.memoryCache.get(key)
    if (!item) return null
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryCache.delete(key)
      return null
    }
    return typeof item.value === 'string' ? item.value : item.value.toString()
  }

  async set(key: string, value: string, ttlSeconds = 86400): Promise<void> {
    if (this.isRedisConnected && this.client) {
      try {
        await this.client.set(key, value, 'EX', ttlSeconds)
        return
      } catch (err: any) {
        this.logger.warn(`Redis set error for key ${key}: ${err.message}`)
      }
    }

    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_ITEMS) {
      const firstKey = this.memoryCache.keys().next().value
      if (firstKey) this.memoryCache.delete(firstKey)
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    })
  }

  async del(key: string): Promise<void> {
    if (this.isRedisConnected && this.client) {
      try {
        await this.client.del(key)
      } catch (err: any) {
        this.logger.warn(`Redis del error for key ${key}: ${err.message}`)
      }
    }
    this.memoryCache.delete(key)
  }
}
