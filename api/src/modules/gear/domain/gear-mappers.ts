import { GearCondition, GearItemSource, GearOptionObjective } from './gear.types'

export type WireGearCondition = 'new' | 'good' | 'worn' | 'poor'
export type WireGearItemSource = 'manual' | 'ai_image' | 'ai_link'
export type WireGearObjective = 'MIN_RENTAL_FEE' | 'MIN_KNOWN_TOTAL_WEIGHT'

/**
 * Bi-directional typed mappers between Wire/API format and Database/Domain Enums.
 * Zero external dependencies.
 */
export const GearMappers = {
  condition: {
    toDb(wire: string): GearCondition {
      switch (wire.toLowerCase()) {
        case 'new':
          return 'NEW'
        case 'good':
          return 'GOOD'
        case 'worn':
          return 'WORN'
        case 'poor':
          return 'POOR'
        default:
          throw new Error(`Unsupported wire condition: ${wire}`)
      }
    },
    toWire(db: string): WireGearCondition {
      switch (db.toUpperCase()) {
        case 'NEW':
          return 'new'
        case 'GOOD':
          return 'good'
        case 'WORN':
          return 'worn'
        case 'POOR':
          return 'poor'
        default:
          throw new Error(`Unsupported db condition: ${db}`)
      }
    },
  },

  source: {
    toDb(wire: string): GearItemSource {
      switch (wire.toLowerCase()) {
        case 'manual':
          return 'MANUAL'
        case 'ai_image':
          return 'AI_IMAGE'
        case 'ai_link':
          return 'AI_LINK'
        default:
          throw new Error(`Unsupported wire source: ${wire}`)
      }
    },
    toWire(db: string): WireGearItemSource {
      switch (db.toUpperCase()) {
        case 'MANUAL':
          return 'manual'
        case 'AI_IMAGE':
          return 'ai_image'
        case 'AI_LINK':
          return 'ai_link'
        default:
          throw new Error(`Unsupported db source: ${db}`)
      }
    },
  },

  objective: {
    toDb(wire: string): GearOptionObjective {
      switch (wire) {
        case 'MIN_RENTAL_FEE':
          return 'ECONOMICAL'
        case 'MIN_KNOWN_TOTAL_WEIGHT':
        case 'MIN_KNOWN_WEIGHT': // Legacy alias tolerance
          return 'LIGHTWEIGHT'
        default:
          throw new Error(
            `Unsupported public wire objective: ${wire}. Only MIN_RENTAL_FEE and MIN_KNOWN_TOTAL_WEIGHT are supported.`,
          )
      }
    },
    toWire(db: string): WireGearObjective {
      switch (db.toUpperCase()) {
        case 'ECONOMICAL':
          return 'MIN_RENTAL_FEE'
        case 'LIGHTWEIGHT':
          return 'MIN_KNOWN_TOTAL_WEIGHT'
        default:
          throw new Error(`Unsupported db objective for public wire: ${db}`)
      }
    },
  },
}
