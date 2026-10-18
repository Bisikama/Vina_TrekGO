import { Injectable, Logger } from '@nestjs/common'
import sharp from 'sharp'
import { IElevationProvider, LatLng } from '../../application/ports/elevation-provider.port'
import { RedisService } from '../../../../shared/redis/redis.service'

export interface TileData {
  data: Buffer
  width: number
  height: number
  channels: number
}

const MAX_MERCATOR_LAT = 85.05112878

export function lonLatToTile(latitude: number, longitude: number, zoom: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('INVALID_COORDINATE')
  }
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 15) {
    throw new Error('INVALID_ZOOM')
  }
  const lat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, latitude))
  const lon = longitude === 180 ? -180 : longitude
  const n = 2 ** zoom
  const xf = ((lon + 180) / 360) * n
  const rad = (lat * Math.PI) / 180
  const yf = ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n
  const x = Math.max(0, Math.min(n - 1, Math.floor(xf)))
  const y = Math.max(0, Math.min(n - 1, Math.floor(yf)))
  return { z: zoom, x, y, u: xf - Math.floor(xf), v: yf - Math.floor(yf) }
}

@Injectable()
export class AwsTerrariumElevationAdapter implements IElevationProvider {
  private readonly logger = new Logger(AwsTerrariumElevationAdapter.name)
  private readonly zoom = 13
  private readonly inFlightPromises = new Map<string, Promise<TileData>>()
  private readonly inMemoryTileCache = new Map<string, TileData>()
  private readonly MAX_IN_MEMORY_TILES = 100

  constructor(private readonly redisService: RedisService) {}

  private async loadTile(x: number, y: number): Promise<TileData> {
    const tileKey = `${this.zoom}/${x}/${y}`

    // 1. Check in-memory decoded cache
    const memCached = this.inMemoryTileCache.get(tileKey)
    if (memCached) return memCached

    // 2. Check in-flight promises (deduplicate simultaneous requests for same tile)
    let pending = this.inFlightPromises.get(tileKey)
    if (pending) return pending

    pending = (async () => {
      const redisKey = `dem:terrarium:${this.zoom}:${x}:${y}`

      let pngBytes: Buffer | null = await this.redisService.getBuffer(redisKey)

      if (!pngBytes) {
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${this.zoom}/${x}/${y}.png`
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
          if (!response.ok) {
            throw new Error(`DEM_HTTP_${response.status}`)
          }
          const arrayBuf = await response.arrayBuffer()
          pngBytes = Buffer.from(arrayBuf)

          // Cache raw PNG in Redis for 7 days (tiles are immutable)
          await this.redisService.setBuffer(redisKey, pngBytes, 7 * 86400)
        } catch (fetchErr: any) {
          this.logger.warn(`Failed to fetch Terrarium tile ${tileKey}: ${fetchErr.message}`)
          throw fetchErr
        }
      }

      if (pngBytes.byteLength > 2_500_000) {
        throw new Error('DEM_TILE_TOO_LARGE')
      }

      const { data, info } = await sharp(pngBytes)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      if (info.channels < 3) {
        throw new Error('DEM_INVALID_CHANNELS')
      }

      const tileData: TileData = {
        data,
        width: info.width,
        height: info.height,
        channels: info.channels,
      }

      // Store in memory LRU cache
      if (this.inMemoryTileCache.size >= this.MAX_IN_MEMORY_TILES) {
        const firstKey = this.inMemoryTileCache.keys().next().value
        if (firstKey) this.inMemoryTileCache.delete(firstKey)
      }
      this.inMemoryTileCache.set(tileKey, tileData)

      return tileData
    })()

    this.inFlightPromises.set(tileKey, pending)
    pending
      .catch(() => {})
      .finally(() => {
        this.inFlightPromises.delete(tileKey)
      })

    return pending
  }

  private pixel(tile: TileData, x: number, y: number): number {
    const px = Math.max(0, Math.min(tile.width - 1, x))
    const py = Math.max(0, Math.min(tile.height - 1, y))
    const idx = (py * tile.width + px) * tile.channels
    const r = tile.data[idx]
    const g = tile.data[idx + 1]
    const b = tile.data[idx + 2]
    return r * 256 + g + b / 256 - 32768
  }

  async getElevations(points: LatLng[]): Promise<(number | null)[]> {
    if (points.length === 0) return []

    return Promise.all(
      points.map(async (p) => {
        try {
          const { x, y, u, v } = lonLatToTile(p.latitude, p.longitude, this.zoom)
          const tile = await this.loadTile(x, y)

          const fx = u * tile.width
          const fy = v * tile.height

          const x0 = Math.min(tile.width - 1, Math.floor(fx))
          const y0 = Math.min(tile.height - 1, Math.floor(fy))
          const x1 = Math.min(tile.width - 1, x0 + 1)
          const y1 = Math.min(tile.height - 1, y0 + 1)

          const tx = fx - Math.floor(fx)
          const ty = fy - Math.floor(fy)

          const a = this.pixel(tile, x0, y0)
          const b = this.pixel(tile, x1, y0)
          const c = this.pixel(tile, x0, y1)
          const d = this.pixel(tile, x1, y1)

          // Bilinear interpolation
          const elevation =
            (1 - ty) * ((1 - tx) * a + tx * b) +
            ty * ((1 - tx) * c + tx * d)

          return Math.round(elevation * 10) / 10
        } catch {
          // If DEM fails for a point, fallback to device altitude if provided and finite, else null
          if (p.altitudeM !== undefined && p.altitudeM !== null && Number.isFinite(Number(p.altitudeM))) {
            return Number(p.altitudeM)
          }
          return null
        }
      }),
    )
  }
}
