import sharp from 'sharp'
import { AwsTerrariumElevationAdapter } from './infrastructure/adapters/aws-terrarium.adapter'

describe('Terrarium bounded loading and fallback', () => {
  let originalFetch: typeof fetch
  let redis: any
  let adapter: AwsTerrariumElevationAdapter

  beforeEach(() => {
    originalFetch = global.fetch
    redis = { getBuffer: jest.fn().mockResolvedValue(null), setBuffer: jest.fn().mockResolvedValue(undefined) }
    adapter = new AwsTerrariumElevationAdapter(redis)
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('loads a shared tile once and reuses the decoded cache on the next call', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 128, g: 100, b: 0 } } })
      .png()
      .toBuffer()
    global.fetch = jest.fn(async () => new Response(new Uint8Array(png))) as any
    const points = Array.from({ length: 1000 }, () => ({ latitude: 10, longitude: 106 }))
    expect(await adapter.getElevations(points)).toEqual(Array(1000).fill(100))
    expect(await adapter.getElevations(points.slice(0, 1))).toEqual([100])
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(redis.setBuffer).toHaveBeenCalledTimes(1)
  })

  it('limits concurrent tile loads across requests and falls back per point', async () => {
    let active = 0
    let maximum = 0
    global.fetch = jest.fn(async () => {
      active++
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      throw new Error('offline')
    }) as any
    const points = Array.from({ length: 8 }, (_, index) => ({ latitude: 10, longitude: index, altitudeM: index + 100 }))
    const results = await Promise.all([adapter.getElevations(points), adapter.getElevations(points)])
    expect(maximum).toBeLessThanOrEqual(4)
    expect(results[0]).toEqual(points.map((point) => point.altitudeM))
    expect(results[1]).toEqual(results[0])
  })

  it('cancels oversized tile streams before caching them', async () => {
    const cancel = jest.fn()
    global.fetch = jest.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(2_500_001))
            },
            cancel,
          }),
        ),
    ) as any
    expect(await adapter.getElevations([{ latitude: 10, longitude: 106, altitudeM: 150 }])).toEqual([150])
    expect(cancel).toHaveBeenCalled()
    expect(redis.setBuffer).not.toHaveBeenCalled()
  })
})
