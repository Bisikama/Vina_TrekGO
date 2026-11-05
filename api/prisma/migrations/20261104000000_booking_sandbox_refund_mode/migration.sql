-- Additive: existing refunds retain their execution mode and provider history.
ALTER TYPE "refund_execution_mode" ADD VALUE IF NOT EXISTS 'SANDBOX_SIMULATED';
