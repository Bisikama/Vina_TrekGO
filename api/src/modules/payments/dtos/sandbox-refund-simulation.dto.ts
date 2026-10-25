import { z } from 'zod'

export const SandboxSimulateRefundParamSchema = z
  .object({
    refundId: z.string().uuid('refundId phải là định dạng UUID hợp lệ'),
  })
  .strict()

export type SandboxSimulateRefundParamDto = z.infer<typeof SandboxSimulateRefundParamSchema>

export const SandboxSimulateRefundBodySchema = z
  .object({
    expectedVersion: z.number().int().positive().optional(),
    reason: z.string().trim().min(5, 'Lý do mô phỏng phải có ít nhất 5 ký tự').max(500),
    acknowledgeSandboxSimulation: z.literal(true, {
      message: 'Bắt buộc xác nhận acknowledgeSandboxSimulation: true',
    }),
    expectedProviderStatus: z.literal('PROCESSING', {
      message: 'Chỉ được phép mô phỏng khi expectedProviderStatus là PROCESSING',
    }),
    testEvidenceRef: z.string().trim().max(200).optional(),
  })
  .strict()

export type SandboxSimulateRefundBodyDto = z.infer<typeof SandboxSimulateRefundBodySchema>

export interface SandboxSimulateRefundResponseDto {
  simulationId: string
  refundId: string
  rentalOrderId: string
  depositSettlementId: string
  provider: 'VNPAY_SANDBOX'
  providerRefundStatus: 'SUCCEEDED'
  simulationStatus: 'SIMULATED'
  simulatedAmount: string
  currency: string
  orderStatus: string
  financialStatus: string
  completionMode: 'SANDBOX_SIMULATED' | 'STANDARD'
  settlementMode: 'SANDBOX_SIMULATED'
  settlementProcessingStatus: 'PENDING' | 'APPLIED'
  simulatedAt: string
  actorAdminId: string
  reason: string
  warnings: string[]
  notices: {
    userNotice: string
    adminNotice: string
  }
}
