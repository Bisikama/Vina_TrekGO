import { z } from 'zod'

export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const weatherTripParamSchema = z.object({
  tripId: z.string().regex(UUID_REGEX, { message: 'tripId phải là UUID hợp lệ' }),
})

export type WeatherTripParam = z.infer<typeof weatherTripParamSchema>
