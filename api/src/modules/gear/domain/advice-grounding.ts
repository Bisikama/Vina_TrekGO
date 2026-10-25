export interface NarrativeGroundingInput {
  narrativeVi: string;
  tripDays: number;
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

  // 5. Rental fee grounding: verify stated fee against server totalRentalFee
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

  // 6. Product mentions grounding: verify any specific product recommended to rent against allowedCandidateNames
  const normalizedAllowedNames = allowedCandidateNames.map((n) => n.trim().toLowerCase());
  const rentMatches = lower.matchAll(
    /(?:thuê|mượn|chọn thuê)\s+([a-zA-Z0-9_\u00C0-\u1EF9\s]+?)(?:\s+(?:giá|với|tại|ở|cho|cỡ|size|\.|,|$))/gi,
  );
  for (const m of rentMatches) {
    const candidatePhrase = m[1].trim();
    if (candidatePhrase && candidatePhrase.length > 2) {
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
