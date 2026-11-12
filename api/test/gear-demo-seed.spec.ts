import { CANONICAL_SAMPLE_GEAR_ITEMS, inspectRentalReadiness, seedGearDemo } from '../prisma/seed-gear-demo'
import { CATEGORY_ATTRIBUTE_SCHEMAS } from '../src/modules/gear/application/dtos/user-gear.dto'
import { GEAR_RULE_METADATA_REGISTRY } from '../src/modules/gear/domain/rule-metadata.registry'
import { PrismaTripContextReadAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-trip-context-read.adapter'
import nuiDinh from '../prisma/seeds/data/destination-nui-dinh.seed.json'

describe('gear demo seed', () => {
  function setup() {
    const items: any[] = []
    const rules: any[] = []
    const tx = {
      gearRequirementRule: {
        createMany: jest.fn(async ({ data }) => {
          const missing = data.filter((r: any) => !rules.some((old) => old.id === r.id))
          rules.push(...missing)
          return { count: missing.length }
        }),
      },
      userGearItem: {
        findFirst: jest.fn(async ({ where }) =>
          items.find((i) => i.userId === where.userId && where.name.in.includes(i.name)),
        ),
        create: jest.fn(async ({ data }) => {
          items.push(data)
          return data
        }),
      },
    }
    const client: any = {
      user: { findUnique: jest.fn(async () => ({ id: 'user', status: 'ACTIVE' })) },
      gearRequirementRule: { findMany: jest.fn(async () => rules) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    }
    return { client, items, rules }
  }

  it('tạo dữ liệu đúng schema và chạy lại không ghi đè hoặc thêm trùng', async () => {
    for (const item of CANONICAL_SAMPLE_GEAR_ITEMS) {
      expect(CATEGORY_ATTRIBUTE_SCHEMAS[item.category].safeParse(item.attributes).success).toBe(true)
    }
    const { client, items } = setup()
    expect(await seedGearDemo(client, 'user')).toEqual({
      rules: GEAR_RULE_METADATA_REGISTRY.length,
      items: CANONICAL_SAMPLE_GEAR_ITEMS.length,
    })
    items[0].attributes = { edited: true }
    expect(await seedGearDemo(client, 'user')).toEqual({ rules: 0, items: 0 })
    expect(items[0].attributes).toEqual({ edited: true })
    expect(items.every((item) => item.userId === 'user' && !item.name.includes('[DEMO]'))).toBe(true)
  })

  it('nhận diện món có tiền tố cũ mà không ghi đè hoặc tạo bản sao', async () => {
    const { client, items } = setup()
    items.push({ userId: 'user', name: `[DEMO] ${CANONICAL_SAMPLE_GEAR_ITEMS[0].name}`, attributes: { edited: true } })
    expect((await seedGearDemo(client, 'user')).items).toBe(CANONICAL_SAMPLE_GEAR_ITEMS.length - 1)
    expect(items[0].attributes).toEqual({ edited: true })
    expect(items.filter((item) => item.name.includes(CANONICAL_SAMPLE_GEAR_ITEMS[0].name))).toHaveLength(1)
  })

  it('dừng trước khi ghi khi quy tắc hiện có không tương thích', async () => {
    const { client, rules } = setup()
    rules.push({ ...GEAR_RULE_METADATA_REGISTRY[0], isActive: false })
    await expect(seedGearDemo(client, 'user')).rejects.toThrow('không khớp')
    expect(client.$transaction).not.toHaveBeenCalled()
  })

  it('dừng trước khi ghi khi phiên bản quy tắc không khớp', async () => {
    const { client, rules } = setup()
    rules.push({ ...GEAR_RULE_METADATA_REGISTRY[0], ruleVersion: 'old' })
    await expect(seedGearDemo(client, 'user')).rejects.toThrow('không khớp')
    expect(client.$transaction).not.toHaveBeenCalled()
  })

  it('đọc địa hình từ snapshot cung Núi Dinh trong dữ liệu seed', () => {
    const trail = nuiDinh.system_trails.find((item) => item.code === 'HBS_COKIEU_LABAN')!
    const adapter = new PrismaTripContextReadAdapter({} as any) as any
    const facts = adapter.extractFacts(
      { id: 'trip', startAt: new Date('2026-01-01'), endAt: new Date('2026-01-02') },
      { id: 'plan', snapshotDifficulty: trail.difficulty, snapshotGeojson: trail.route_geojson },
    )
    expect(facts.difficulty).toBe(3)
    expect(facts.terrain).toEqual(['mountain', 'rocky'])
  })

  it('không ghi nếu tài khoản không hoạt động', async () => {
    const { client } = setup()
    client.user.findUnique.mockResolvedValue({ id: 'user', status: 'INACTIVE' })
    await expect(seedGearDemo(client, 'user')).rejects.toThrow('ACTIVE')
    expect(client.$transaction).not.toHaveBeenCalled()
  })

  it('không ghi nếu chuyến đi không đủ quyền hoặc dữ kiện', async () => {
    const { client } = setup()
    const check = jest
      .spyOn(PrismaTripContextReadAdapter.prototype, 'getTripContext')
      .mockRejectedValueOnce(new Error('Chuyến không hợp lệ'))
    await expect(seedGearDemo(client, 'user', 'trip')).rejects.toThrow('Chuyến không hợp lệ')
    expect(client.$transaction).not.toHaveBeenCalled()
    check.mockRestore()
  })

  it('báo thiếu chính sách thuê trước khi tạo dữ liệu demo', async () => {
    const { client } = setup()
    client.rentalPolicy = { findFirst: jest.fn().mockResolvedValue(null) }
    const check = jest.spyOn(PrismaTripContextReadAdapter.prototype, 'getTripContext').mockResolvedValue({} as any)
    await expect(inspectRentalReadiness(client, 'user', 'trip')).rejects.toThrow('chính sách thuê')
    expect(client.$transaction).not.toHaveBeenCalled()
    check.mockRestore()
  })
})
