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
    const factRefs = owned.filter((o) => o.requirementId).map((o) => `requirement.${o.requirementId}:COVERED_BY_OWNED`)
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
    const rentDetails = lines.map((l) => `${l.quantity > 1 ? `${l.quantity} ` : ''}${l.productName}`).join(', ')
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
  textLines.push('Hãy kiểm tra kỹ toàn bộ trang bị, đảm bảo độ bám và khả năng chống thấm nước trước ngày khởi hành.')

  const narrativeVi = textLines.join('\n\n')
  const factRefs = Array.from(new Set(chosenClaims.flatMap((c) => c.factRefs)))

  return {
    narrativeVi,
    factRefs,
    isValid: true,
  }
}
