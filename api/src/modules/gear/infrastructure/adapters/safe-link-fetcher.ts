import * as dns from 'dns'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'

export interface FetchedPageResult {
  url: string
  finalUrl: string
  textContent: string
  contentHash: string
  title?: string
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const lowerIp = ip.toLowerCase().trim()

  // IPv6 Loopback / Unspecified
  if (lowerIp === '::1' || lowerIp === '::') return true

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or hex format ::ffff:7f00:1)
  if (lowerIp.startsWith('::ffff:')) {
    const v4part = lowerIp.substring(7)
    if (v4part.includes('.')) {
      return isPrivateOrReservedIp(v4part)
    }
    const parts = v4part.split(':')
    if (parts.length === 2) {
      const high = parseInt(parts[0], 16)
      const low = parseInt(parts[1], 16)
      if (!isNaN(high) && !isNaN(low)) {
        const b1 = (high >> 8) & 0xff
        const b2 = high & 0xff
        const b3 = (low >> 8) & 0xff
        const b4 = low & 0xff
        return isPrivateOrReservedIp(`${b1}.${b2}.${b3}.${b4}`)
      }
    }
  }

  // IPv6 Link-Local (fe80::/10, covers 0xfe80 - 0xfebf, e.g. fe80, fe90, fea0, feb0)
  // IPv6 Unique Local (fc00::/7, covers 0xfc00 - 0xfdff, e.g. fc00, fd00)
  const firstWord = lowerIp.split(':')[0]
  const firstWordNum = parseInt(firstWord, 16)
  if (!isNaN(firstWordNum)) {
    if ((firstWordNum & 0xffc0) === 0xfe80) return true // fe80::/10
    if ((firstWordNum & 0xfe00) === 0xfc00) return true // fc00::/7
  }

  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\./.test(ip)) return true

  // IPv4 Private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (/^10\./.test(ip)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true

  // IPv4 Link-local / AWS / GCP / Azure metadata (169.254.0.0/16)
  if (/^169\.254\./.test(ip)) return true

  // Broadcast & Current network (0.0.0.0/8, 255.255.255.255)
  if (/^0\./.test(ip) || ip === '255.255.255.255') return true

  // Multicast (224.0.0.0/4) & Reserved (240.0.0.0/4)
  const firstOctet = parseInt(ip.split('.')[0], 10)
  if (!isNaN(firstOctet) && (firstOctet >= 224 || firstOctet >= 240)) return true

  return false
}

export class SafeLinkFetcher {
  private readonly maxBytes = 2 * 1024 * 1024 // 2MB
  private readonly timeoutMs = 10000 // 10s
  private readonly maxRedirects = 3

  async validateAndResolveUrl(rawUrl: string): Promise<URL> {
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED, {
        message: 'Định dạng đường dẫn URL không hợp lệ',
      })
    }

    if (parsed.protocol !== 'https:') {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED, {
        message: 'Chỉ chấp nhận đường dẫn sản phẩm bảo mật giao thức HTTPS',
      })
    }

    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED, {
        message: 'Đường dẫn trỏ đến hostname cục bộ hoặc nội bộ bị cấm',
      })
    }

    // Direct IP format check
    if (isPrivateOrReservedIp(hostname)) {
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED, {
        message: 'Đường dẫn trỏ đến địa chỉ IP nội bộ hoặc mạng riêng bị cấm',
      })
    }

    // DNS Resolution check
    try {
      const records = await dns.promises.lookup(hostname, { all: true })
      if (!records || records.length === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: `Không thể phân giải tên miền: ${hostname}`,
        })
      }

      for (const rec of records) {
        if (isPrivateOrReservedIp(rec.address)) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_SSRF_BLOCKED, {
            message: `Tên miền phân giải về địa chỉ IP nội bộ bị cấm: ${rec.address}`,
          })
        }
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
        message: `Lỗi phân giải DNS cho đường dẫn: ${err?.message}`,
      })
    }

    return parsed
  }

  async fetchPage(targetUrl: string): Promise<string> {
    let currentUrl = targetUrl
    let redirectsCount = 0

    while (redirectsCount <= this.maxRedirects) {
      const parsedUrl = await this.validateAndResolveUrl(currentUrl)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)

      let response: Response
      try {
        response = await fetch(parsedUrl.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'VinaTrekGO-GearAdvisor/3.1.5 (+https://vinatrekgo.vn/bot)',
            Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
          },
          redirect: 'manual', // Enforce manual redirect handling to check SSRF on each hop
          signal: controller.signal,
        })
      } catch (err: any) {
        clearTimeout(timer)
        if (err?.name === 'AbortError') {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
            message: 'Quá thời gian chờ khi tải nội dung trang web (timeout)',
          })
        }
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: `Lỗi kết nối khi tải trang web: ${err?.message}`,
        })
      } finally {
        clearTimeout(timer)
      }

      // Handle redirect
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (!location) {
          throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
            message: 'Phản hồi chuyển hướng thiếu tiêu đề Location',
          })
        }
        currentUrl = new URL(location, parsedUrl).toString()
        redirectsCount++
        continue
      }

      if (response.status === 401 || response.status === 403) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_READER_UNAVAILABLE, {
          message:
            'Trang web sản phẩm yêu cầu đăng nhập hoặc từ chối truy cập. Vui lòng nhập thông số bằng tay hoặc tải ảnh.',
        })
      }

      if (!response.ok) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: `Trang web sản phẩm phản hồi mã lỗi HTTP ${response.status}`,
        })
      }

      const contentType = response.headers.get('content-type') || ''
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml+xml') &&
        !contentType.includes('text/plain')
      ) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: `Định dạng nội dung không được hỗ trợ (${contentType}), chỉ chấp nhận trang HTML/text`,
        })
      }

      const rawHtml = await response.text()
      if (rawHtml.length > this.maxBytes) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
          message: `Kích thước trang web vượt quá giới hạn tối đa 2MB`,
        })
      }

      return this.cleanHtmlToText(rawHtml)
    }

    throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PAGE_FETCH_FAILED, {
      message: 'Vượt quá số lượt chuyển hướng tối đa cho phép (3 redirects)',
    })
  }

  cleanHtmlToText(html: string): string {
    // Strip scripts, styles, svg, noscript
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')

    // Replace linebreaks / block elements with newlines
    text = text
      .replace(/<\/(p|div|tr|li|h1|h2|h3|h4|h5|h6|section|article)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ') // remove remaining tags

    // Collapse multiple whitespaces and newlines
    text = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')

    // Limit maximum text length passed to model (e.g. 50000 characters)
    return text.substring(0, 50000)
  }
}
