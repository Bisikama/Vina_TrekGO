import { z } from 'zod'
import { DifficultyLevel, TripStatus } from '@prisma/client'

// Regex kiểm tra định dạng UUID 8-4-4-4-12 chuẩn xác (hỗ trợ cả RFC 4122 và UUID từ database/seed)
export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// 1. Validate Param đầu vào: tripId
export const navigationContextParamSchema = z.object({
  tripId: z.string().regex(UUID_REGEX, { message: 'tripId phải là UUID hợp lệ' }),
})
export type NavigationContextParam = z.infer<typeof navigationContextParamSchema>

// 2. Schema cho Active Trail (Lộ trình đang kích hoạt)
export const activeTrailSchema = z.object({
  planId: z.string().regex(UUID_REGEX, { message: 'planId phải là UUID hợp lệ' }),
  name: z.string(),
  difficulty: z.nativeEnum(DifficultyLevel).nullable(), // <-- Enum Prisma
  distanceKm: z.number().nullable(),
  elevationGainM: z.number().nullable(),
  routeGeojson: z.any(),
})
export type ActiveTrailDto = z.infer<typeof activeTrailSchema>

// 3. Schema cho Planned Trails (Các lộ trình dự phòng)
export const plannedTrailSchema = z.object({
  planId: z.string().regex(UUID_REGEX, { message: 'planId phải là UUID hợp lệ' }),
  sequence: z.number().int(),
  name: z.string(),
  difficulty: z.nativeEnum(DifficultyLevel).nullable(), // <-- Enum Prisma
  distanceKm: z.number().nullable(),
  elevationGainM: z.number().nullable(),
})
export type PlannedTrailDto = z.infer<typeof plannedTrailSchema>

// 4. Schema cho Nhiệm vụ tại Checkpoint
export const checkpointMissionSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  type: z.string().nullable(),
  rewardPoints: z.number().int(),
})
export type CheckpointMissionDto = z.infer<typeof checkpointMissionSchema>

// 5. Schema cho Checkpoint bắt buộc
export const requiredCheckpointSchema = z.object({
  id: z.string().regex(UUID_REGEX, { message: 'id phải là UUID hợp lệ' }),
  sequence: z.number().int(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.number().int(),
  isRequired: z.boolean(),
  mission: checkpointMissionSchema.nullable(),
})
export type RequiredCheckpointDto = z.infer<typeof requiredCheckpointSchema>

// 6. Schema tổng thể Response trả về
export const navigationContextResponseSchema = z.object({
  tripId: z.string().regex(UUID_REGEX, { message: 'tripId phải là UUID hợp lệ' }),
  title: z.string(),
  tripStatus: z.nativeEnum(TripStatus), // <-- Enum Prisma
  activeTrail: activeTrailSchema.nullable(),
  plannedTrails: z.array(plannedTrailSchema),
  requiredCheckpoints: z.array(requiredCheckpointSchema),
})
export type NavigationContextResponse = z.infer<typeof navigationContextResponseSchema>
