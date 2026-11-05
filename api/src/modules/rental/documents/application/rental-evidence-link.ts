/**
 * Link ảnh bằng chứng in trong PDF chứng từ.
 * PDF không chứa link Cloudinary (link ký của Cloudinary không hết hạn); thay vào đó là link về backend có chữ ký HMAC
 * gắn với (chứng từ, ảnh). Backend kiểm lại rồi mới chuyển hướng sang Cloudinary, nên đổi secret là thu hồi mọi link.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import envconfig from 'src/shared/config'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function settings() {
  const secret = process.env.RENTAL_DOCUMENT_LINK_SECRET ?? envconfig.RENTAL_DOCUMENT_LINK_SECRET
  const base = process.env.RENTAL_DOCUMENT_LINK_BASE_URL ?? envconfig.RENTAL_DOCUMENT_LINK_BASE_URL
  return { secret: secret && secret.length >= 32 ? secret : null, base: base ? base.replace(/\/+$/, '') : null }
}

function sign(secret: string, documentId: string, mediaId: string) {
  return createHmac('sha256', secret)
    .update(`rental-document-evidence:v1:${documentId.toLowerCase()}:${mediaId.toLowerCase()}`)
    .digest('base64url')
}

/** URL bấm được cho một ảnh bằng chứng; null khi chưa cấu hình hoặc id không phải UUID. */
export function rentalEvidenceLink(documentId: string, mediaId: string): string | null {
  const { secret, base } = settings()
  if (!secret || !base || !UUID.test(documentId) || !UUID.test(mediaId)) return null
  return `${base}/api/v1/rental-documents/${documentId}/evidence/${mediaId}?sig=${sign(secret, documentId, mediaId)}`
}

export function verifyRentalEvidenceSignature(documentId: string, mediaId: string, signature: unknown): boolean {
  const { secret } = settings()
  if (!secret || typeof signature !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false
  return timingSafeEqual(Buffer.from(sign(secret, documentId, mediaId)), Buffer.from(signature))
}

/** Mọi id ảnh bằng chứng mà snapshot chứng từ tham chiếu; link chỉ mở được các ảnh này. */
export function documentEvidenceIds(snapshot: unknown): Set<string> {
  const ids = new Set<string>()
  const add = (value: unknown) => {
    if (typeof value === 'string' && UUID.test(value)) ids.add(value.toLowerCase())
  }
  const list = (value: unknown) => (Array.isArray(value) ? value : [])
  const s = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {}
  for (const unit of [...list(s.units), ...list(s.receivedUnits)]) {
    if (unit && typeof unit === 'object') list((unit as Record<string, unknown>).evidenceIds).forEach(add)
  }
  list(s.evidenceIds).forEach(add)
  add(s.failureEvidenceId)
  return ids
}
