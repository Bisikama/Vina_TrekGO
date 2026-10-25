export interface NarrativeGroundingInput {
  narrativeVi: string;
  tripDays: number;
  tripDifficulty?: number;
  climate?: {
    temp_min_c?: number;
    temp_max_c?: number;
    rain_prob_pct?: number;
  };
  totalRentalFee: number;
  allowedCandidateNames: string[];
  allowedCandidateIds: Set<string>;
  allowedFactSet: Set<string>;
  modelFactRefs: string[];
  modelCandidateRefs: string[];
  hasMissingRequired: boolean;
}

export interface NarrativeGroundingResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates AI advice narrative and refs strictly against approved server facts and candidate sets.
 * Eliminates hallucinations, fabricated fees, wrong trip durations, unapproved products, and fake safety claims.
 */
export function validateNarrativeViGrounding(
  input: NarrativeGroundingInput,
): NarrativeGroundingResult {
  const {
    narrativeVi,
    tripDays,
    tripDifficulty,
    climate,
    totalRentalFee,
    allowedCandidateNames,
    allowedCandidateIds,
    allowedFactSet,
    modelFactRefs,
    modelCandidateRefs,
    hasMissingRequired,
  } = input;

  if (!narrativeVi || narrativeVi.trim() === '') {
    return { isValid: false, reason: 'Narrative is empty' };
  }

  // 1. Fact Refs validation: must be non-empty and every ref must belong to approvedFactSet
  if (!modelFactRefs || modelFactRefs.length === 0) {
    return { isValid: false, reason: 'Model did not provide any fact refs' };
  }
  for (const ref of modelFactRefs) {
    if (!allowedFactSet.has(ref)) {
      return { isValid: false, reason: `Unapproved fact ref in model response: ${ref}` };
    }
  }

  // 2. Candidate Refs validation: every referenced candidate must belong to allowedCandidateIds
  if (modelCandidateRefs && modelCandidateRefs.length > 0) {
    for (const ref of modelCandidateRefs) {
      const prodId = ref.split(':')[0];
      if (!allowedCandidateIds.has(prodId)) {
        return { isValid: false, reason: `Unapproved candidate product ref: ${ref}` };
      }
    }
  }

  const lower = narrativeVi.toLowerCase();

  // 3. Safety claims vs missing required items
  const claimsFullSafety =
    lower.includes('an toàn tuyệt đối') ||
    lower.includes('đầy đủ 100%') ||
    lower.includes('không cần bổ sung');

  if (hasMissingRequired && claimsFullSafety) {
    return {
      isValid: false,
      reason: 'Narrative claims 100% safety despite missing critical required items',
    };
  }

  // 4. Trip duration grounding: any mention of number before 'ngày' must match tripDays
  const dayMatches = lower.matchAll(/(\d+)\s*ngày/gi);
  for (const m of dayMatches) {
    const d = parseInt(m[1], 10);
    if (d !== tripDays) {
      return {
        isValid: false,
        reason: `Trip days mismatch: narrative claims ${d} ngày, but trip is ${tripDays} ngày`,
      };
    }
  }

  // 5. Trip difficulty grounding: any mention of difficulty level must match tripDifficulty
  if (tripDifficulty !== undefined) {
    const diffMatches = lower.matchAll(/(?:độ khó|cấp độ khó)\s*(?:cấp|level)?\s*(\d+)(?:\s*\/\s*5)?/gi);
    for (const m of diffMatches) {
      const diffVal = parseInt(m[1], 10);
      if (diffVal !== tripDifficulty) {
        return {
          isValid: false,
          reason: `Difficulty mismatch: narrative claims độ khó ${diffVal}, but trip difficulty is ${tripDifficulty}`,
        };
      }
    }
  }

  // 6. Climate facts grounding: temperature and rain probability
  if (climate) {
    if (climate.temp_min_c !== undefined) {
      const minTempMatches = lower.matchAll(
        /(?:nhiệt độ thấp nhất|nhiệt độ tối thiểu|lạnh nhất)\s*(?:là|khoảng|xuống|tới)?\s*(-?\d+)\s*(?:°c|độ c|c\b)/gi,
      );
      for (const m of minTempMatches) {
        const val = parseInt(m[1], 10);
        if (val !== climate.temp_min_c) {
          return {
            isValid: false,
            reason: `Minimum temperature mismatch: narrative claims ${val}°C, but trip min temp is ${climate.temp_min_c}°C`,
          };
        }
      }
    }

    if (climate.temp_max_c !== undefined) {
      const maxTempMatches = lower.matchAll(
        /(?:nhiệt độ cao nhất|nhiệt độ tối đa|nóng nhất)\s*(?:là|khoảng|lên|tới)?\s*(-?\d+)\s*(?:°c|độ c|c\b)/gi,
      );
      for (const m of maxTempMatches) {
        const val = parseInt(m[1], 10);
        if (val !== climate.temp_max_c) {
          return {
            isValid: false,
            reason: `Maximum temperature mismatch: narrative claims ${val}°C, but trip max temp is ${climate.temp_max_c}°C`,
          };
        }
      }
    }

    if (climate.rain_prob_pct !== undefined) {
      const rainMatches = lower.matchAll(
        /(?:xác suất mưa|khả năng mưa|tỉ lệ mưa|tỷ lệ mưa)\s*(?:là|khoảng|đạt|lên tới)?\s*(\d+)\s*%/gi,
      );
      for (const m of rainMatches) {
        const val = parseInt(m[1], 10);
        if (val !== climate.rain_prob_pct) {
          return {
            isValid: false,
            reason: `Rain probability mismatch: narrative claims ${val}%, but trip rain probability is ${climate.rain_prob_pct}%`,
          };
        }
      }
    }
  }

  // 7. Rental fee grounding: verify stated fee against server totalRentalFee
  const feeMatches = lower.matchAll(
    /(?:phí thuê|tiền thuê|chi phí thuê|tổng phí thuê|giá thuê|chi phí)\s*(?:khoảng|là|hết|chỉ|tổng cộng|dự kiến)?\s*([0-9.,]+)\s*(k|đ|vnd|đồng|nghìn|ngàn)?\b/gi,
  );
  for (const m of feeMatches) {
    const rawNum = m[1].replace(/\./g, '').replace(/,/g, '');
    let val = parseInt(rawNum, 10);
    if (Number.isNaN(val)) continue;

    const unit = (m[2] || '').toLowerCase();
    if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') {
      val = val * 1000;
    }

    if (val !== totalRentalFee) {
      return {
        isValid: false,
        reason: `Rental fee mismatch: narrative claims ${val} VND, but server fee is ${totalRentalFee} VND`,
      };
    }
  }

  // 8. Product mentions grounding: verify any specific product recommended to rent against allowedCandidateNames
  const normalizedAllowedNames = allowedCandidateNames.map((n) => n.trim().toLowerCase());
  const rentMatches = lower.matchAll(
    /(?<!không\s+(?:cần\s+|nên\s+)?|chưa\s+(?:cần\s+)?)(?:thuê|mượn|chọn thuê)[:\s]+([a-zA-Z0-9_\u00C0-\u1EF9\s]+?)(?:[.,:;!?\n\r(]|\s+(?:giá|với|tại|ở|cho|cỡ|size|\.|,)|\s*$)/gi,
  );
  for (const m of rentMatches) {
    const candidatePhrase = m[1].trim();
    if (candidatePhrase && candidatePhrase.length > 2) {
      if (normalizedAllowedNames.length === 0) {
        return {
          isValid: false,
          reason: `Unapproved product mentioned for rental when no rental products are approved: "${candidatePhrase}"`,
        };
      }
      const isKnown = normalizedAllowedNames.some(
        (name) => name.includes(candidatePhrase) || candidatePhrase.includes(name),
      );
      if (!isKnown) {
        return {
          isValid: false,
          reason: `Unapproved product mentioned for rental: "${candidatePhrase}"`,
        };
      }
    }
  }

  return { isValid: true };
}