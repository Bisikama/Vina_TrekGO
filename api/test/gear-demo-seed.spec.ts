import { CANONICAL_SAMPLE_GEAR_ITEMS, seedGearDemo } from '../prisma/seed-gear-demo'
import { CATEGORY_ATTRIBUTE_SCHEMAS } from '../src/modules/gear/application/dtos/user-gear.dto'
import { GEAR_RULE_METADATA_REGISTRY } from '../src/modules/gear/domain/rule-metadata.registry'
import { PrismaTripContextReadAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-trip-context-read.adapter'

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
        findFirst: jest.fn(async ({ where }) => items.find((i) => i.userId === where.userId && i.name === where.name)),
        create: jest.fn(async ({ data }) => { items.push(data); return data }),
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
    expect(await seedGearDemo(client, 'user')).toEqual({ rules: GEAR_RULE_METADATA_REGISTRY.length, items: CANONICAL_SAMPLE_GEAR_ITEMS.length })
    items[0].attributes = { edited: true }
    expect(await seedGearDemo(client, 'user')).toEqual({ rules: 0, items: 0 })
    expect(items[0].attributes).toEqual({ edited: true })
    expect(items.every((item) => item.userId === 'user' && item.name.startsWith('[DEMO] '))).toBe(true)
  })

  it('dừng trước khi ghi khi quy tắc hiện có không tương thích', async () => {
    const { client, rules } = setup()
    rules.push({ ...GEAR_RULE_METADATA_REGISTRY[0], isActive: false })
    await expect(seedGearDemo(client, 'user')).rejects.toThrow('không khớp')
    expect(client.$transaction).not.toHaveBeenCalled()
  })

  it('không ghi nếu tài khoản không hoạt động', async () => {
    const { client } = setup()
    client.user.findUnique.mockResolvedValue({ id: 'user', status: 'INACTIVE' })
    await expect(seedGearDemo(client, 'user')).rejects.toThrow('ACTIVE')
    expect(client.$transaction).not.toHaveBeenCalled()
  })

  it('không ghi nếu chuyến đi không đủ quyền hoặc dữ kiện', async () => {
    const { client } = setup()
    const check = jest.spyOn(PrismaTripContextReadAdapter.prototype, 'getTripContext').mockRejectedValueOnce(new Error('Chuyến không hợp lệ'))
    await expect(seedGearDemo(client, 'user', 'trip')).rejects.toThrow('Chuyến không hợp lệ')
    expect(client.$transaction).not.toHaveBeenCalled()
    check.mockRestore()
  })
})
