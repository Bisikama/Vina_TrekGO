import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import {
  GearAiPort,
  GearExtractionAiRequest,
  GearExtractionAiResult,
} from '../../application/ports/gear-ai.port';
import { normalizeExtractionResult } from '../../domain/gear-extraction-schema';
import { GEAR_EXTRACTION_PROMPT } from '../prompts/prompt-assets';

@Injectable()
export class OpenAiGearAiAdapter implements GearAiPort {
  private readonly logger = new Logger(OpenAiGearAiAdapter.name);

  constructor() {}

  private getConfig() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL_EXTRACTION?.trim() || 'gpt-4o-mini';
    const timeoutMs = parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10);
    const maxRetries = parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10);
    return { apiKey, model, timeoutMs, maxRetries };
  }

  async extractGear(request: GearExtractionAiRequest): Promise<GearExtractionAiResult> {
    const { apiKey, model, timeoutMs, maxRetries } = this.getConfig();

    if (!apiKey) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_UNAVAILABLE, {
        message: 'Dịch vụ nhận diện AI hiện chưa được cấu hình (LIVE_AI_BLOCKED). Vui lòng nhập thông số bằng tay.',
      });
    }

    const messages: Array<{ role: string; content: any }> = [
      {
        role: 'system',
        content: GEAR_EXTRACTION_PROMPT.content,
      },
    ];

    if (request.sourceType === 'IMAGE') {
      const base64Data = request.imageBase64 || request.imageBuffer?.toString('base64');
      if (!base64Data) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
          message: 'Không có dữ liệu ảnh để trích xuất',
        });
      }
      const mime = request.mimeType || 'image/jpeg';
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mime};base64,${base64Data}`,
            },
          },
          {
            type: 'text',
            text: 'Trích xuất thông số kỹ thuật trang bị từ ảnh này sang JSON đúng schema.',
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: request.textContent || '',
          },
        ],
      });
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      const remainingTime = timeoutMs - (Date.now() - startTime);
      if (remainingTime <= 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_TIMEOUT, {
          message: 'Quá thời gian chờ phản hồi từ dịch vụ AI (timeout)',
        });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remainingTime);

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.status === 429) {
          lastError = AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_RATE_LIMITED, {
            message: 'Dịch vụ AI vượt quá giới hạn tần suất (rate limit 429)',
          });
          attempt++;
          if (attempt <= maxRetries) {
            await new Promise((res) => setTimeout(res, 200 * Math.pow(2, attempt)));
            continue;
          }
          throw lastError;
        }

        if (response.status >= 500) {
          lastError = AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
            message: `Lỗi máy chủ AI provider (${response.status})`,
          });
          attempt++;
          if (attempt <= maxRetries) {
            await new Promise((res) => setTimeout(res, 200 * Math.pow(2, attempt)));
            continue;
          }
          throw lastError;
        }

        if (!response.ok) {
          const errText = await response.text();
          this.logger.warn(`OpenAI call failed with ${response.status}: ${errText}`);
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
            message: 'Yêu cầu tới dịch vụ AI không hợp lệ',
          });
        }

        const data: any = await response.json();
        const latencyMs = Date.now() - startTime;
        const choice = data.choices?.[0];

        if (choice?.message?.refusal) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_REFUSED, {
            message: `Dịch vụ AI từ chối trích xuất: ${choice.message.refusal}`,
          });
        }

        const content = choice?.message?.content;
        if (!content) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_SCHEMA_MISMATCH, {
            message: 'Phản hồi từ AI rỗng hoặc không có nội dung',
          });
        }

        let rawParsed: any;
        try {
          rawParsed = JSON.parse(content);
        } catch {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_SCHEMA_MISMATCH, {
            message: 'Phản hồi từ AI không phải JSON hợp lệ',
          });
        }

        const domainResult = normalizeExtractionResult(rawParsed);

        return {
          extraction: domainResult,
          metadata: {
            promptVersion: GEAR_EXTRACTION_PROMPT.version,
            promptHash: GEAR_EXTRACTION_PROMPT.hash,
            modelVersion: model,
            schemaVersion: '3.1.5',
            usage: data.usage
              ? {
                  promptTokens: data.usage.prompt_tokens,
                  completionTokens: data.usage.completion_tokens,
                  totalTokens: data.usage.total_tokens,
                }
              : undefined,
            latencyMs,
          },
        };
      } catch (err: any) {
        clearTimeout(timer);
        if (err?.name === 'AbortError') {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_AI_TIMEOUT, {
            message: 'Quá thời gian chờ phản hồi từ dịch vụ AI',
          });
        }
        if (err instanceof AppError) {
          if (err.code === GEAR_ERROR_CODES.GEAR_AI_RATE_LIMITED && attempt < maxRetries) {
            attempt++;
            continue;
          }
          throw err;
        }
        lastError = err;
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise((res) => setTimeout(res, 200 * Math.pow(2, attempt)));
          continue;
        }
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
          message: `Lỗi kết nối tới dịch vụ AI: ${err?.message}`,
        });
      }
    }

    throw (
      lastError ||
      AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_FAILED, {
        message: 'Lỗi không xác định khi gọi AI provider',
      })
    );
  }
}

