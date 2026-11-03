import { Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { performance } from 'node:perf_hooks'
import { PrismaService } from '../../shared/services/prisma.service'

// Do not log Prisma messages/meta: they may contain SQL parameters or provider data.
export function paymentFailure(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  return {
    errorType: error instanceof Error ? error.name : 'UnknownError',
    errorCode: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : undefined,
    stack:
      error instanceof Error
        ? error.stack
          ?.split('\n')
          .filter((line) => /^\s+at /.test(line))
          .join('\n')
        : undefined,
  }
}

export async function paymentTransaction<T>(
  db: PrismaService,
  logger: Logger,
  operation: string,
  context: { eventId?: string; paymentId?: string; resourceId?: string; kind?: string },
  work: (tx: Prisma.TransactionClient, stage: (name: string) => void) => Promise<T>,
): Promise<T> {
  const started = performance.now()
  let stageStarted = started
  let stageName = 'acquire'
  const stages: Record<string, number> = {}
  const stage = (name: string) => {
    const now = performance.now()
    stages[stageName] = (stages[stageName] ?? 0) + Math.round(now - stageStarted)
    stageStarted = now
    stageName = name
  }
  try {
    const result = await db.$transaction(
      async (tx) => {
        stage('read')
        const value = await work(tx, stage)
        stage('commit')
        return value
      },
      { timeout: 30_000 },
    )
    stage('done')
    const entry = { operation, ...context, elapsedMs: Math.round(performance.now() - started), stages }
    // Only recovery polling diagnostics are opt-in; failures always remain visible.
    if (entry.elapsedMs >= 2000) {
      if (operation !== 'recovery.claim' || process.env.PAYMENT_RECOVERY_CLAIM_SLOW_LOG_ENABLED === 'true')
        logger.warn({ message: 'Slow payment transaction', ...entry })
    } else if (operation !== 'recovery.claim' || process.env.PAYMENT_RECOVERY_CLAIM_DEBUG_ENABLED === 'true')
      logger.debug(entry)
    return result
  } catch (error) {
    const failedStage = stageName
    stage('failed')
    logger.warn({
      message: 'Payment transaction failed',
      operation,
      ...context,
      elapsedMs: Math.round(performance.now() - started),
      failedStage,
      stages,
      ...paymentFailure(error),
    })
    throw error
  }
}
