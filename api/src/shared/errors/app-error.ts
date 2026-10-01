export interface AppErrorParams {
  code: string;
  message?: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly retryable?: boolean;

  constructor(params: AppErrorParams) {
    super(params.message || params.code);
    this.name = 'AppError';
    this.code = params.code;
    this.details = params.details;
    this.retryable = params.retryable;
    
    // Ensure the prototype chain is correctly maintained
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static fromCode(code: string, overrides?: { message?: string; details?: Record<string, unknown> }) {
    return new AppError({
      code,
      message: overrides?.message,
      details: overrides?.details,
    });
  }
}
