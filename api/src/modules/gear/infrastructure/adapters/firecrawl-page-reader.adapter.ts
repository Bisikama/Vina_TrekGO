import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PageReaderPort, PageReadResult } from '../../application/ports/page-reader.port';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import { SafeLinkFetcher } from './safe-link-fetcher';

@Injectable()
export class FirecrawlPageReaderAdapter implements PageReaderPort {
  private readonly logger = new Logger(FirecrawlPageReaderAdapter.name);
  private readonly linkFetcher = new SafeLinkFetcher();

  private readonly apiKey: string | null;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY || null;
    this.apiUrl = (process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev').replace(/\/+$/, '');
    this.timeoutMs = parseInt(process.env.FIRECRAWL_TIMEOUT_MS || '30000', 10);
  }

  async readPage(rawUrl: string): Promise<PageReadResult> {
    // 1. Mandatory Public HTTPS & SSRF validation
    await this.linkFetcher.validateAndResolveUrl(rawUrl);

    // 2. Key Availability check (LINK_LIVE_BLOCKED -> 503)
    if (!this.apiKey) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_READER_UNAVAILABLE, {
        message: 'Dịch vụ đọc link sản phẩm chưa được cấu hình. Vui lòng tải ảnh hoặc nhập bằng tay.',
      });
    }

    // 3. Call Firecrawl Cloud API with bounded response reading and strict timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/v1/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: rawUrl,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_READER_UNAVAILABLE, {
            message: 'Khóa truy cập dịch vụ đọc link không hợp lệ hoặc hết hạn',
          });
        }
        if (response.status === 429) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_EXTRACTION_QUOTA_EXCEEDED, {
            message: 'Dịch vụ đọc trang đang vượt quá hạn mức yêu cầu, vui lòng thử lại sau',
          });
        }
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: `Không thể đọc nội dung sản phẩm từ đường dẫn (mã trạng thái HTTP ${response.status})`,
        });
      }

      // Check Content-Type header before reading body
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('+json')) {
        controller.abort();
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: `Phản hồi từ dịch vụ đọc trang không đúng định dạng JSON (Content-Type: ${contentType})`,
        });
      }

      // Stream read with strict byte limit (max 2MB raw response) to prevent unbounded memory allocation
      const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
      let text = '';

      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.byteLength;
              if (totalBytes > MAX_RESPONSE_BYTES) {
                await reader.cancel();
                controller.abort();
                throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
                  message: 'Dung lượng phản hồi từ trang web vượt quá giới hạn an toàn 2MB',
                });
              }
              chunks.push(value);
            }
          }
        } finally {
          reader.releaseLock();
        }
        text = Buffer.concat(chunks).toString('utf-8');
      } else {
        // Fallback for mock environments where body.getReader is not emulated
        text = await response.text();
        if (Buffer.byteLength(text, 'utf-8') > MAX_RESPONSE_BYTES) {
          controller.abort();
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
            message: 'Dung lượng phản hồi từ trang web vượt quá giới hạn an toàn 2MB',
          });
        }
      }

      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: 'Phản hồi từ dịch vụ đọc trang không đúng định dạng JSON chuẩn',
        });
      }

      if (!json?.success || !json?.data?.markdown) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: 'Không tìm thấy nội dung văn bản sản phẩm hợp lệ tại đường dẫn đã cung cấp',
        });
      }

      const rawMarkdown = String(json.data.markdown).trim();
      // Bounded body limit (500KB UTF-8 bytes) to prevent unbounded memory growth
      const MAX_MARKDOWN_BYTES = 500 * 1024;
      const rawMarkdownBuf = Buffer.from(rawMarkdown, 'utf-8');
      const boundedBuf =
        rawMarkdownBuf.byteLength > MAX_MARKDOWN_BYTES
          ? rawMarkdownBuf.subarray(0, MAX_MARKDOWN_BYTES)
          : rawMarkdownBuf;
      const markdown = boundedBuf.toString('utf-8').trim();
      const contentHash = crypto.createHash('sha256').update(markdown).digest('hex');
      const finalUrl = json.data.metadata?.sourceURL || rawUrl;

      // Validate redirect final URL against SSRF
      if (finalUrl !== rawUrl) {
        await this.linkFetcher.validateAndResolveUrl(finalUrl);
      }

      const title = json.data.metadata?.title || undefined;

      return {
        url: rawUrl,
        finalUrl,
        markdown,
        contentHash,
        title,
        readAt: new Date(),
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err?.name === 'AbortError') {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: 'Quá thời gian chờ phản hồi từ trang sản phẩm (vượt quá 30 giây)',
        });
      }
      this.logger.error(`Error reading page with Firecrawl: ${err?.message}`);
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
        message: `Lỗi kết nối khi đọc trang sản phẩm: ${err?.message || 'Không xác định'}`,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
