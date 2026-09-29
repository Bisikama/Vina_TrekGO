import { z } from 'zod'
import { DifficultyLevel } from '@prisma/client'

import { UUID_REGEX } from './navigation-context.dto'

// Validate dữ liệu gửi lên khi Leader đổi đường
export const switchTrailSchema = z.object({
  toPlanId: z.string().regex(UUID_REGEX, { message: 'toPlanId phải là UUID hợp lệ của lộ trình dự phòng' }),
  reason: z.string().trim().max(500, { message: 'Lý do tối đa 500 ký tự' }).optional(),
})
export type SwitchTrailDto = z.infer<typeof switchTrailSchema>

// Response trả về sau khi đổi đường thành công theo Cross-Domain Contract RC-FR-103
export interface SwitchTrailResponse {
  event: 'ACTIVE_TRAIL_CHANGED'
  message: string
  tripId: string
  fromPlanId: string | null
  toPlanId: string
  changedAt: string
  reason: string | null
  preservedCheckpointsCount: number
  activeTrail: {
    planId: string
    name: string
    difficulty: DifficultyLevel | null
    distanceKm: number | null
    elevationGainM: number | null
    routeGeojson: any
  }
}
