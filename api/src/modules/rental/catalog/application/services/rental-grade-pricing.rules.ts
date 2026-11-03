import { AppError, RENTAL_ERROR_CODES } from '../../../../../shared/errors'
import { UserRole } from '../../../../../shared/constants/enum.constant'

/**
 * Quy tắc giá/cọc cho sản phẩm thuê, gồm cả sản phẩm có hạng (LIKE_NEW / GOOD_USED).
 * Mỗi hạng là một RentalProduct riêng, nối nhau bằng gradeGroupId.
 * Các hàm ở đây thuần (không đọc DB); adapter gọi chúng bên trong transaction đã khoá dòng.
 */

export type RentalGradeValue = 'LIKE_NEW' | 'GOOD_USED'

export interface DepositPolicyInput {
  type: string
  amount?: number
  percentage?: number
}

export interface CurrentFinancials {
  replacementValue: number
  depositPolicyType: string
  depositValue: number
}

export interface GradePricingSnapshot {
  id: string
  grade: RentalGradeValue
  status: string
  dailyPrice: number
  depositPolicyType: string
  depositValue: number
}

export function isAdminRole(role: string | undefined): boolean {
  return role === UserRole.ADMIN
}

/** Giá trị lưu ở cột deposit_value: số tiền (FIXED) hoặc phần trăm (PERCENT_REPLACEMENT_VALUE). */
export function depositValueOf(policy: DepositPolicyInput): number {
  return policy.type === 'FIXED' ? (policy.amount ?? 0) : (policy.percentage ?? 0)
}

/**
 * Policy RB-TBD-03: cọc và giá trị thay thế do ADMIN cấu hình. Người khác chỉ được gửi lại đúng giá trị hiện tại
 * (để form gửi nguyên trạng không bị chặn). Khi tạo mới (current = undefined) thì không được gửi.
 */
export function assertFinancialFieldsAllowed(
  actorRole: string | undefined,
  requested: { replacementValue?: number; depositPolicy?: DepositPolicyInput },
  current?: CurrentFinancials,
): void {
  if (isAdminRole(actorRole)) return

  const changedFields: string[] = []
  if (requested.replacementValue !== undefined) {
    if (!current || requested.replacementValue !== current.replacementValue) changedFields.push('replacementValue')
  }
  if (requested.depositPolicy !== undefined) {
    const same =
      current !== undefined &&
      requested.depositPolicy.type === current.depositPolicyType &&
      depositValueOf(requested.depositPolicy) === current.depositValue
    if (!same) changedFields.push('depositPolicy')
  }

  if (changedFields.length > 0) {
    throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_PRODUCT_FINANCIAL_FIELDS_ADMIN_ONLY, {
      details: { fields: changedFields },
    })
  }
}

/** Sản phẩm có hạng chỉ dùng cọc FIXED, để cọc của mỗi hạng là một con số rõ ràng. */
export function assertGradedDepositIsFixed(
  grade: string | null | undefined,
  depositPolicyType: string | undefined,
): void {
  if (grade && depositPolicyType !== undefined && depositPolicyType !== 'FIXED') {
    throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_DEPOSIT_MUST_BE_FIXED, {
      details: { grade, depositPolicyType },
    })
  }
}

/**
 * Khi LIKE_NEW và GOOD_USED cùng ACTIVE trong một nhóm: giá ngày và cọc của LIKE_NEW phải lớn hơn hẳn GOOD_USED.
 * Nếu một bên không ACTIVE thì không kiểm (cho phép ADMIN chỉnh lần lượt từng hạng trước khi mở bán).
 */
export function assertGradePriceOrder(products: GradePricingSnapshot[]): void {
  const active = products.filter((p) => p.status === 'ACTIVE')
  const likeNew = active.find((p) => p.grade === 'LIKE_NEW')
  const goodUsed = active.find((p) => p.grade === 'GOOD_USED')
  if (!likeNew || !goodUsed) return

  const fields: string[] = []
  if (!(likeNew.dailyPrice > goodUsed.dailyPrice)) fields.push('dailyPrice')
  if (!(likeNew.depositValue > goodUsed.depositValue)) fields.push('deposit')

  if (fields.length > 0) {
    throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_PRICE_ORDER_INVALID, {
      details: {
        fields,
        likeNew: { productId: likeNew.id, dailyPrice: likeNew.dailyPrice, deposit: likeNew.depositValue },
        goodUsed: { productId: goodUsed.id, dailyPrice: goodUsed.dailyPrice, deposit: goodUsed.depositValue },
      },
    })
  }
}
