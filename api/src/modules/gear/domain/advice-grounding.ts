export interface NarrativeGroundingInput {
  narrativeVi: string
  tripDays: number
  tripDifficulty?: number
  climate?: {
    temp_min_c?: number
    temp_max_c?: number
    rain_prob_pct?: number
  }
  totalRentalFee: number
  totalDeposit?: number
  allowedCandidateNames: string[]
  allowedCandidateIds: Set<string>
  allowedFactSet: Set<string>
  modelFactRefs: string[]
  modelCandidateRefs: string[]
  hasMissingRequired: boolean
  gearSpecs?: {
    waterproof_mm?: number[]
    weight_g?: number[]
    capacity_liters?: number[]
  }
}

export interface NarrativeGroundingResult {
  isValid: boolean
  reason?: string
}

/**
 * Validates AI advice narrative and refs strictly against approved server facts and candidate sets.
 * Eliminates hallucinations, fabricated fees, fabricated deposits, wrong trip durations, unapproved products,
 * contradictory weather facts, and unsupported gear specifications.
 */
export function validateNarrativeViGrounding(input: NarrativeGroundingInput): NarrativeGroundingResult {
  const {
    narrativeVi,
    tripDays,
    tripDifficulty,
    climate,
    totalRentalFee,
    totalDeposit,
    allowedCandidateNames,
    allowedCandidateIds,
    allowedFactSet,
    modelFactRefs,
    modelCandidateRefs,
    hasMissingRequired,
    gearSpecs,
  } = input

  if (!narrativeVi || narrativeVi.trim() === '') {
    return { isValid: false, reason: 'Narrative is empty' }
  }

  // 1. Fact Refs validation: must be non-empty and every ref must belong to approvedFactSet
  if (!modelFactRefs || modelFactRefs.length === 0) {
    return { isValid: false, reason: 'Model did not provide any fact refs' }
  }
  for (const ref of modelFactRefs) {
    if (!allowedFactSet.has(ref)) {
      return { isValid: false, reason: `Unapproved fact ref in model response: ${ref}` }
    }
  }

  // 2. Candidate Refs validation: every referenced candidate must belong to allowedCandidateIds
  if (modelCandidateRefs && modelCandidateRefs.length > 0) {
    for (const ref of modelCandidateRefs) {
      const prodId = ref.split(':')[0]
      if (!allowedCandidateIds.has(prodId)) {
        return { isValid: false, reason: `Unapproved candidate product ref: ${ref}` }
      }
    }
  }

  const lower = narrativeVi.toLowerCase()

  // 3. Safety claims vs missing required items
  const claimsFullSafety =
    lower.includes('an toàn tuyệt đối') ||
    lower.includes('đầy đủ 100%') ||
    lower.includes('không cần bổ sung') ||
    lower.includes('hoàn toàn yên tâm') ||
    lower.includes('đủ 100%') ||
    lower.includes('đầy đủ trang bị')

  if (hasMissingRequired && claimsFullSafety) {
    return {
      isValid: false,
      reason: 'Narrative claims 100% safety despite missing critical required items',
    }
  }

  // 4. Trip duration grounding: any mention of number before 'ngày' or 'day' must match tripDays
  const dayMatches = lower.matchAll(/(\d+)\s*(?:ngày|day)/gi)
  for (const m of dayMatches) {
    const d = parseInt(m[1], 10)
    if (d !== tripDays) {
      return {
        isValid: false,
        reason: `Trip days mismatch: narrative claims ${d} ngày, but trip is ${tripDays} ngày`,
      }
    }
  }

  // 5. Trip difficulty grounding: any mention of difficulty level must match tripDifficulty
  if (tripDifficulty !== undefined) {
    const diffMatches = lower.matchAll(/(?:độ khó|cấp độ khó|cấp độ|level)\s*(?:cấp|level)?\s*(\d+)(?:\s*\/\s*5)?/gi)
    for (const m of diffMatches) {
      const diffVal = parseInt(m[1], 10)
      if (diffVal !== tripDifficulty) {
        return {
          isValid: false,
          reason: `Difficulty mismatch: narrative claims độ khó ${diffVal}, but trip difficulty is ${tripDifficulty}`,
        }
      }
    }
  }

  // 6. Climate facts grounding: temperature and rain probability
  if (climate) {
    if (climate.temp_min_c !== undefined) {
      const minTempMatches = lower.matchAll(
        /(?:nhiệt độ thấp nhất|nhiệt độ tối thiểu|lạnh nhất)\s*(?:là|khoảng|xuống|tới)?\s*(-?\d+)\s*(?:°\s*c|độ\s*c|độ\b(?!\s*khó))/gi,
      )
      for (const m of minTempMatches) {
        const val = parseInt(m[1], 10)
        if (val !== climate.temp_min_c) {
          return {
            isValid: false,
            reason: `Minimum temperature mismatch: narrative claims ${val}°C, but trip min temp is ${climate.temp_min_c}°C`,
          }
        }
      }
    }

    if (climate.temp_max_c !== undefined) {
      const maxTempMatches = lower.matchAll(
        /(?:nhiệt độ cao nhất|nhiệt độ tối đa|nóng nhất)\s*(?:là|khoảng|lên|tới)?\s*(-?\d+)\s*(?:°\s*c|độ\s*c|độ\b(?!\s*khó))/gi,
      )
      for (const m of maxTempMatches) {
        const val = parseInt(m[1], 10)
        if (val !== climate.temp_max_c) {
          return {
            isValid: false,
            reason: `Maximum temperature mismatch: narrative claims ${val}°C, but trip max temp is ${climate.temp_max_c}°C`,
          }
        }
      }
    }

    // General temperature assertions (e.g. "Dự báo 40°C", "40 độ", "Thời tiết khoảng 40°C")
    if (climate.temp_min_c !== undefined && climate.temp_max_c !== undefined) {
      const minBound = climate.temp_min_c - 2
      const maxBound = climate.temp_max_c + 2
      const generalTempMatches = lower.matchAll(/(-?\d+)\s*(?:°\s*c|độ\s*c|độ\b(?!\s*khó))/gi)
      for (const m of generalTempMatches) {
        const val = parseInt(m[1], 10)
        if (val < minBound || val > maxBound) {
          return {
            isValid: false,
            reason: `Temperature contradiction: narrative claims ${val}°C, which is outside trip temperature range [${climate.temp_min_c}°C, ${climate.temp_max_c}°C]`,
          }
        }
      }
    }

    // Rain probability assertions (e.g. "xác suất mưa 60%", "mưa 0%", "khả năng mưa 80%", "xác suất có mưa bằng không")
    if (climate.rain_prob_pct !== undefined) {
      // 1. Explicit numerical percentages
      const rainMatches = lower.matchAll(
        /(?:xác suất(?: có)? mưa|khả năng mưa|tỉ lệ mưa|tỷ lệ mưa|mưa|dự báo mưa)[^.!?\n\r,]*?(\d+)\s*%/gi,
      )
      for (const m of rainMatches) {
        const val = parseInt(m[1], 10)
        if (val !== climate.rain_prob_pct) {
          return {
            isValid: false,
            reason: `Rain probability mismatch: narrative claims ${val}%, but trip rain probability is ${climate.rain_prob_pct}%`,
          }
        }
      }

      const reverseRainMatches = lower.matchAll(/(\d+)\s*%\s*(?:mưa|khả năng mưa|xác suất mưa|cơ hội mưa)/gi)
      for (const m of reverseRainMatches) {
        const val = parseInt(m[1], 10)
        if (val !== climate.rain_prob_pct) {
          return {
            isValid: false,
            reason: `Rain probability mismatch: narrative claims ${val}%, but trip rain probability is ${climate.rain_prob_pct}%`,
          }
        }
      }

      // 2. Qualitative / zero rain contradiction checks
      const claimsZeroRain =
        /(?:xác suất(?: có)? mưa|khả năng mưa|tỉ lệ mưa|tỷ lệ mưa|mưa)[^.!?\n\r,]*?(?:bằng không|bằng 0|không%?|0%|rất thấp)/i.test(
          lower,
        ) ||
        /(?:không có mưa|hoàn toàn không mưa|tuyệt đối không mưa)/i.test(lower)

      if (claimsZeroRain && climate.rain_prob_pct >= 30) {
        return {
          isValid: false,
          reason: `Rain contradiction: narrative claims 0% / no rain, but trip rain probability is ${climate.rain_prob_pct}%`,
        }
      }
    }
  }

  // 7. Rental fee grounding: verify stated fee against server totalRentalFee
  const feeMatches = lower.matchAll(
    /(?:phí thuê|tiền thuê|chi phí thuê|tổng phí thuê|giá thuê|chi phí)\s*(?:khoảng|là|hết|chỉ|tổng cộng|dự kiến)?\s*([0-9.,]+)\s*(k|đ|vnd|đồng|nghìn|ngàn)?\b/gi,
  )
  for (const m of feeMatches) {
    const rawNum = m[1].replace(/\./g, '').replace(/,/g, '')
    let val = parseInt(rawNum, 10)
    if (Number.isNaN(val)) continue

    const unit = (m[2] || '').toLowerCase()
    if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') {
      val = val * 1000
    }

    if (val !== totalRentalFee) {
      return {
        isValid: false,
        reason: `Rental fee mismatch: narrative claims ${val} VND, but server fee is ${totalRentalFee} VND`,
      }
    }
  }

  // 8. Deposit grounding: verify stated deposit against server totalDeposit
  const effectiveDeposit = totalDeposit ?? 0
  const depositMatches = lower.matchAll(
    /(?:tiền đặt cọc|đặt cọc|tiền cọc|khoản cọc|phí cọc|cọc)\s*(?:khoảng|là|hết|chỉ|tổng cộng|dự kiến)?\s*([0-9.,]+)\s*(k|đ|vnd|đồng|nghìn|ngàn)?\b/gi,
  )
  for (const m of depositMatches) {
    const rawNum = m[1].replace(/\./g, '').replace(/,/g, '')
    let val = parseInt(rawNum, 10)
    if (Number.isNaN(val)) continue

    const unit = (m[2] || '').toLowerCase()
    if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') {
      val = val * 1000
    }

    if (val !== effectiveDeposit) {
      return {
        isValid: false,
        reason: `Deposit mismatch: narrative claims ${val} VND, but server deposit is ${effectiveDeposit} VND`,
      }
    }
  }

  // 9. Product mentions grounding: verify any specific product recommended to rent against allowedCandidateNames
  // Note: negative lookbehind ensures fee phrases (chi phí thuê, tiền thuê...) do not trigger product inspection.
  const normalizedAllowedNames = allowedCandidateNames.map((n) => n.trim().toLowerCase())
  const rentMatches = lower.matchAll(
    /(?<!(?:chi phí|tiền|giá|phí|tổng phí|tổng chi phí|ngân sách|khoản)\s+)(?<!không\s+(?:cần\s+|nên\s+)?|chưa\s+(?:cần\s+)?)(?:thuê|mượn|chọn thuê)[:\s]+([a-zA-Z0-9_\u00C0-\u1EF9\s]+?)(?:[.,:;!?\n\r(]|\s+(?:giá|với|tại|ở|cho|cỡ|size|\.|,)|\s*$)/gi,
  )
  for (const m of rentMatches) {
    const candidatePhrase = m[1].trim()
    // Skip fee and price clauses following recommendation verbs (e.g. "thuê khoảng 100.000", "thuê với giá 50k")
    if (/^(?:khoảng\s+\d|\d+\s*(?:k|đ|vnd|đồng)|với\s+giá|hết\s+\d)/i.test(candidatePhrase)) {
      continue
    }

    // Strip leading quantities if present (e.g. "2 lều X999" -> "lều X999", "1 chiếc áo" -> "áo")
    const cleanedPhrase = candidatePhrase.replace(/^\d+\s*(?:cái|chiếc|bộ|đôi|lượt)?\s*/i, '').trim()

    if (cleanedPhrase && cleanedPhrase.length > 2) {
      if (normalizedAllowedNames.length === 0) {
        return {
          isValid: false,
          reason: `Unapproved product mentioned for rental when no rental products are approved: "${cleanedPhrase}"`,
        }
      }
      const isKnown = normalizedAllowedNames.some(
        (name) => name.includes(cleanedPhrase) || cleanedPhrase.includes(name),
      )
      if (!isKnown) {
        return {
          isValid: false,
          reason: `Unapproved product mentioned for rental: "${cleanedPhrase}"`,
        }
      }
    }
  }

  // 10. Technical specifications grounding: verify claimed specs (e.g. "chống nước 99.999 mm")
  if (gearSpecs) {
    // Waterproof mm check
    const wpMatches = lower.matchAll(/(?:chống nước|kháng nước|waterproof|độ chống nước)\s*(?:khoảng|là)?\s*([0-9.,]+)\s*mm\b/gi)
    for (const m of wpMatches) {
      const rawNum = m[1].replace(/\./g, '').replace(/,/g, '')
      const val = parseInt(rawNum, 10)
      if (Number.isNaN(val)) continue

      const allowedWp = gearSpecs.waterproof_mm || []
      const isVerified = allowedWp.some((w) => Math.abs(w - val) <= val * 0.05)
      if (!isVerified) {
        return {
          isValid: false,
          reason: `Unverified waterproof specification: narrative claims ${val} mm, which is not found in verified gear items`,
        }
      }
    }

    // General standalone high-waterproof spec assertion (e.g. "99.999 mm", "100.000 mm")
    const generalWpMatches = lower.matchAll(/([0-9.,]+)\s*mm\b/gi)
    for (const m of generalWpMatches) {
      const rawNum = m[1].replace(/\./g, '').replace(/,/g, '')
      const val = parseInt(rawNum, 10)
      if (Number.isNaN(val) || val < 1000) continue

      const allowedWp = gearSpecs.waterproof_mm || []
      const isVerified = allowedWp.some((w) => Math.abs(w - val) <= val * 0.05)
      if (!isVerified) {
        return {
          isValid: false,
          reason: `Unverified waterproof specification: narrative claims ${val} mm, which is not found in verified gear items`,
        }
      }
    }
  }

  return { isValid: true }
}

export interface ApprovedClaim {
  id: string
  category: 'TRIP_SUMMARY' | 'CLIMATE_OVERVIEW' | 'OWNED_PREP' | 'RENTAL_PREVIEW' | 'SAFETY_WARNING'
  textVi: string
  factRefs: string[]
  isMandatory?: boolean
}

export interface BuildApprovedClaimsInput {
  tripContext: {
    days?: number
    difficulty?: number
    destination?: string
    terrain?: string[]
    temp_min_c?: number
    temp_max_c?: number
    temp_min_night_c?: number
    rain_prob_pct?: number
  }
  selectedOption: {
    summary?: {
      totalRentalFee?: number
      totalDeposit?: number
      missingRequirements?: string[]
      status?: string
    }
    rentalLines?: Array<{
      productId: string
      productName: string
      quantity: number
      rentalFee?: number
      deposit?: number
      attributes?: Record<string, unknown>
    }>
    ownedAssignments?: Array<{
      requirementId: string
      itemId: string
      itemName?: string
      category: string
      attributes?: Record<string, unknown>
    }>
  }
}

export function buildApprovedClaims(input: BuildApprovedClaimsInput): ApprovedClaim[] {
  const claims: ApprovedClaim[] = []
  const { tripContext, selectedOption } = input

  const days = tripContext.days ?? 1
  const diff = tripContext.difficulty ?? 1
  const destination = tripContext.destination || 'cung đường'

  // 1. Trip Summary
  claims.push({
    id: 'claim:trip_summary',
    category: 'TRIP_SUMMARY',
    textVi: `Hành trình khám phá ${destination} dự kiến diễn ra trong ${days} ngày với cấp độ khó ${diff}/5.`,
    factRefs: [`trip.days:${days}`, `trip.difficulty:${diff}`],
  })

  // 2. Climate Overview
  const { temp_min_c, temp_max_c, temp_min_night_c, rain_prob_pct } = tripContext
  if (temp_min_c !== undefined && temp_max_c !== undefined && rain_prob_pct !== undefined) {
    const nightPart = temp_min_night_c !== undefined ? ` (ban đêm thấp nhất ${temp_min_night_c}°C)` : ''
    claims.push({
      id: 'claim:climate_overview',
      category: 'CLIMATE_OVERVIEW',
      textVi: `Dự báo thời tiết: nhiệt độ dao động từ ${temp_min_c}°C đến ${temp_max_c}°C${nightPart}, xác suất mưa khoảng ${rain_prob_pct}%.`,
      factRefs: [
        `climate.temp_min:${temp_min_c}`,
        `climate.temp_max:${temp_max_c}`,
        `climate.rain_prob:${rain_prob_pct}`,
      ],
    })
  } else {
    claims.push({
      id: 'claim:climate_overview',
      category: 'CLIMATE_OVERVIEW',
      textVi: 'Dữ liệu thời tiết chi tiết chưa được ghi nhận đầy đủ cho cung đường này.',
      factRefs: [],
    })
  }

  // 3. Owned Preparation
  const owned = selectedOption.ownedAssignments || []
  if (owned.length > 0) {
    const ownedNames = owned.map((o) => o.itemName || o.category).join(', ')
    const factRefs = owned
      .filter((o) => o.requirementId)
      .map((o) => `requirement.${o.requirementId}:COVERED_BY_OWNED`)
    claims.push({
      id: 'claim:owned_prep',
      category: 'OWNED_PREP',
      textVi: `Trang bị cá nhân phù hợp: Bạn đã có sẵn ${owned.length} món đáp ứng tiêu chuẩn an toàn (${ownedNames}).`,
      factRefs,
    })
  } else {
    claims.push({
      id: 'claim:owned_prep',
      category: 'OWNED_PREP',
      textVi: 'Chưa có trang bị cá nhân nào được chỉ định cho chuyến đi này.',
      factRefs: [],
    })
  }

  // 4. Rental Preview
  const lines = selectedOption.rentalLines || []
  const fee = selectedOption.summary?.totalRentalFee ?? 0
  const deposit = selectedOption.summary?.totalDeposit ?? 0
  if (lines.length > 0) {
    const rentDetails = lines
      .map((l) => `${l.quantity > 1 ? `${l.quantity} ` : ''}${l.productName}`)
      .join(', ')
    const factRefs = [`pricing.total_fee:${fee}`]
    if (deposit > 0) {
      factRefs.push(`pricing.total_deposit:${deposit}`)
    }
    const depositText = deposit > 0 ? ` (tiền đặt cọc: ${deposit.toLocaleString('vi-VN')} VND)` : ''
    claims.push({
      id: 'claim:rental_preview',
      category: 'RENTAL_PREVIEW',
      textVi: `Trang bị đề xuất thuê: ${rentDetails}. Chi phí thuê ước tính là ${fee.toLocaleString('vi-VN')} VND${depositText}.`,
      factRefs,
    })
  } else {
    claims.push({
      id: 'claim:rental_preview',
      category: 'RENTAL_PREVIEW',
      textVi: 'Bạn không cần thuê thêm trang bị cho chuyến đi này (chi phí thuê: 0 VND).',
      factRefs: [`pricing.total_fee:0`],
    })
  }

  // 5. Safety Warning / Missing Requirements
  const missing = selectedOption.summary?.missingRequirements || []
  if (missing.length > 0) {
    claims.push({
      id: 'claim:safety_warning',
      category: 'SAFETY_WARNING',
      textVi: `Lưu ý an toàn: Còn ${missing.length} yêu cầu bắt buộc chưa có phương án đáp ứng (${missing.join(', ')}). Bạn cần chuẩn bị hoặc thuê bổ sung trước khi khởi hành.`,
      factRefs: missing.map((m) => `requirement.${m}:NOT_COVERED`),
      isMandatory: true,
    })
  } else {
    claims.push({
      id: 'claim:safety_warning',
      category: 'SAFETY_WARNING',
      textVi: 'Bộ trang bị đã đáp ứng đầy đủ các tiêu chuẩn an toàn cốt lõi cho chuyến đi.',
      factRefs: [],
      isMandatory: false,
    })
  }

  return claims
}

export function renderNarrativeFromClaims(
  selectedClaimIds: string[],
  approvedClaims: ApprovedClaim[],
): { narrativeVi: string; factRefs: string[]; isValid: boolean; reason?: string } {
  if (!Array.isArray(selectedClaimIds) || selectedClaimIds.length === 0) {
    return {
      narrativeVi: '',
      factRefs: [],
      isValid: false,
      reason: 'selectedClaimIds must be a non-empty array',
    }
  }

  const claimMap = new Map<string, ApprovedClaim>()
  for (const c of approvedClaims) {
    claimMap.set(c.id, c)
  }

  // Validate every selected ID exists
  for (const id of selectedClaimIds) {
    if (typeof id !== 'string' || !claimMap.has(id)) {
      return {
        narrativeVi: '',
        factRefs: [],
        isValid: false,
        reason: `Unknown claim ID: ${id}`,
      }
    }
  }

  const selectedSet = new Set(selectedClaimIds)
  const chosenClaims: ApprovedClaim[] = []

  // Add selected claims in order
  for (const id of selectedClaimIds) {
    chosenClaims.push(claimMap.get(id)!)
  }

  // Ensure any mandatory claim that AI missed is appended
  for (const c of approvedClaims) {
    if (c.isMandatory && !selectedSet.has(c.id)) {
      chosenClaims.push(c)
    }
  }

  const textLines = chosenClaims.map((c) => c.textVi)
  textLines.push(
    'Hãy kiểm tra kỹ toàn bộ trang bị, đảm bảo độ bám và khả năng chống thấm nước trước ngày khởi hành.',
  )

  const narrativeVi = textLines.join('\n\n')
  const factRefs = Array.from(new Set(chosenClaims.flatMap((c) => c.factRefs)))

  return {
    narrativeVi,
    factRefs,
    isValid: true,
  }
}
