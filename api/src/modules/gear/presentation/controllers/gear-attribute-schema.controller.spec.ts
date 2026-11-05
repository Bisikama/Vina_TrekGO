import { INestApplication, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AuthenticationGuard } from '../../../../shared/guards/authentication.guard'
import { CANONICAL_CATEGORY_FIELD_KEYS, validateAttributesForCategory } from '../../application/dtos/user-gear.dto'
import { GearAttributeSchemaController } from './gear-attribute-schema.controller'

describe('GET /gear/attribute-schema', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [GearAttributeSchemaController] }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalGuards(new AuthenticationGuard(new Reflector(), {
      canActivate: (context: any) => {
        if (context.switchToHttp().getRequest().headers.authorization !== 'Bearer valid') throw new UnauthorizedException()
        return true
      },
    } as never, {} as never))
    await app.init()
  })

  afterAll(async () => { await app.close() })

  it('returns the validated category keys and display metadata without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/gear/attribute-schema').expect(200)
    expect(response.body.categories).toHaveLength(8)
    for (const category of response.body.categories) {
      expect(category.label).toEqual(expect.any(String))
      expect(category.attributes.map((field: any) => field.key)).toEqual(CANONICAL_CATEGORY_FIELD_KEYS[category.category])
      for (const field of category.attributes) {
        expect(field.label).toEqual(expect.any(String))
        expect(field).toHaveProperty('unit')
        expect(field.schema).toEqual(expect.any(Object))
      }
    }
    const footwear = response.body.categories.find((entry: any) => entry.category === 'FOOTWEAR')
    expect(footwear.attributes.find((field: any) => field.key === 'grip_level').schema.anyOf).toContainEqual(
      expect.objectContaining({ type: 'integer', minimum: 1, maximum: 5 }),
    )
    const rain = response.body.categories.find((entry: any) => entry.category === 'RAIN_GEAR')
    expect(rain.attributes.find((field: any) => field.key === 'coverage').schema.anyOf).toContainEqual(
      expect.objectContaining({ enum: ['UPPER_BODY', 'FULL_BODY'] }),
    )
    expect(rain.attributes.find((field: any) => field.key === 'coverage').options).toEqual([
      { value: 'UPPER_BODY', label: 'Thân trên' }, { value: 'FULL_BODY', label: 'Toàn thân' },
    ])
    expect(() => validateAttributesForCategory('TREKKING_POLE', { length_min_cm: 10, length_max_cm: 5 })).toThrow()
    expect(response.body.categories.find((entry: any) => entry.category === 'TREKKING_POLE').rules).toEqual([
      { type: 'lessThanOrEqual', left: 'length_min_cm', right: 'length_max_cm' },
    ])
  })

  it('accepts a valid bearer token and rejects an invalid one', async () => {
    await request(app.getHttpServer()).get('/api/v1/gear/attribute-schema').set('Authorization', 'Bearer valid').expect(200)
    await request(app.getHttpServer()).get('/api/v1/gear/attribute-schema').set('Authorization', 'Bearer invalid').expect(401)
  })
})
