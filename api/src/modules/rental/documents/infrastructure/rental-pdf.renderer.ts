import envconfig from 'src/shared/config';
import { Injectable, Logger } from '@nestjs/common'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { RentalDocument, RentalDocumentType } from '@prisma/client'
import { RENTAL_DOCUMENT_TEMPLATE_VERSION, snapshotHash } from '../application/rental-document-events'
import { rentalEvidenceLink } from '../application/rental-evidence-link'

/** Chứng từ mẫu 1.3.2 phát hành trước đây vẫn render được, dùng bố cục mới. */
const SUPPORTED_TEMPLATE_VERSIONS = new Set(['1.3.2', RENTAL_DOCUMENT_TEMPLATE_VERSION])
const LOGO_PATH = join(__dirname, '..', 'assets', 'vina-trekgo-logo.jpg')
const DEFAULT_FONT_PATH = join(__dirname, '..', 'assets', 'Lato-Regular.ttf')

const headings: Record<RentalDocumentType, string> = {
  HANDOVER: 'BIÊN BẢN BÀN GIAO THIẾT BỊ',
  EXTENSION_APPENDIX: 'PHỤ LỤC GIA HẠN THUÊ',
  RETURN_RECEIPT: 'BIÊN NHẬN THU HỒI THIẾT BỊ',
  SCHEDULE_NOTICE: 'THÔNG BÁO THAY ĐỔI LỊCH TRẢ',
  CORRECTION_NOTICE: 'THÔNG BÁO ĐÍNH CHÍNH',
}

// ---------------------------------------------------------------------------
// Font
// ---------------------------------------------------------------------------

type FontData = {
  bytes: Buffer
  units: number
  ascent: number
  descent: number
  bbox: number[]
  glyph: (code: number) => number
  width: (glyph: number) => number
}

export function formatVndExact(value: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error('INVALID_VND_AMOUNT')
  const negative = value.startsWith('-')
  const [rawWhole, fraction] = (negative ? value.slice(1) : value).split('.')
  const whole = (rawWhole.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative ? '-' : ''}${whole}${fraction ? `,${fraction}` : ''} VND`
}
function parseFont(bytes: Buffer): FontData {
  const u16 = (at: number) => bytes.readUInt16BE(at)
  const i16 = (at: number) => bytes.readInt16BE(at)
  const u32 = (at: number) => bytes.readUInt32BE(at)
  const tables = new Map<string, number>()
  for (let i = 0; i < u16(4); i++) {
    const at = 12 + i * 16
    tables.set(bytes.toString('ascii', at, at + 4), u32(at + 8))
  }
  const table = (name: string) => {
    const at = tables.get(name)
    if (at === undefined) throw new Error(`PDF_FONT_INVALID_${name}`)
    return at
  }
  const head = table('head'),
    hhea = table('hhea'),
    hmtx = table('hmtx'),
    cmap = table('cmap')
  const units = u16(head + 18),
    metrics = u16(hhea + 34)
  const mappings: Array<{ at: number; format: number }> = []
  for (let i = 0; i < u16(cmap + 2); i++) {
    const record = cmap + 4 + i * 8
    const at = cmap + u32(record + 4)
    const format = u16(at)
    if (format === 12 || format === 4) mappings.push({ at, format })
  }
  mappings.sort((a, b) => b.format - a.format)
  if (!mappings.length) throw new Error('PDF_FONT_NO_UNICODE_CMAP')
  const mapping = mappings[0]
  const glyph = (code: number) => {
    if (code < 0 || code > 65535) return 0
    const at = mapping.at
    if (mapping.format === 12) {
      const count = u32(at + 12)
      let lo = 0,
        hi = count - 1
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1,
          p = at + 16 + mid * 12
        if (code < u32(p)) hi = mid - 1
        else if (code > u32(p + 4)) lo = mid + 1
        else return u32(p + 8) + code - u32(p)
      }
      return 0
    }
    const segments = u16(at + 6) / 2
    const end = at + 14,
      start = end + segments * 2 + 2,
      delta = start + segments * 2,
      range = delta + segments * 2
    for (let i = 0; i < segments; i++) {
      if (code > u16(end + 2 * i)) continue
      if (code < u16(start + 2 * i)) return 0
      const d = i16(delta + 2 * i),
        r = u16(range + 2 * i)
      if (!r) return (code + d) & 65535
      const p = range + 2 * i + r + 2 * (code - u16(start + 2 * i))
      const found = u16(p)
      return found ? (found + d) & 65535 : 0
    }
    return 0
  }
  return {
    bytes,
    units,
    ascent: i16(hhea + 4),
    descent: i16(hhea + 6),
    bbox: [i16(head + 36), i16(head + 38), i16(head + 40), i16(head + 42)],
    glyph,
    width: (g) => u16(hmtx + Math.min(g, metrics - 1) * 4),
  }
}

/** Đọc kích thước JPEG từ marker SOF; PDF nhúng JPEG nguyên vẹn bằng DCTDecode. */
function parseJpeg(bytes: Buffer): { width: number; height: number; components: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1]
    const length = bytes.readUInt16BE(at + 2)
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      const components = bytes[at + 9]
      if (components !== 1 && components !== 3) return null
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7), components }
    }
    at += 2 + length
  }
  return null
}

// ---------------------------------------------------------------------------
// Nội dung chứng từ (chỉ các trường đã whitelist; không bao giờ in policy thô hay key tuỳ ý)
// ---------------------------------------------------------------------------

type Tone = 'default' | 'accent' | 'warn' | 'success'
type Highlight = { label: string; value: string; tone?: Tone }
/** `evidence`: id ảnh bằng chứng — in dạng mã ngắn, bấm được khi đã cấu hình link. */
type Field = { label: string; value: string; tone?: Tone; wide?: boolean; evidence?: string[] }
type Column = { title: string; width: number }
type Row = { cells: string[]; tones?: Array<Tone | undefined>; details?: string[]; evidence?: string[] }
export type DocBlock =
  | { kind: 'highlights'; items: Highlight[] }
  | { kind: 'section'; title: string }
  | { kind: 'fields'; items: Field[] }
  | { kind: 'table'; columns: Column[]; rows: Row[] }
  | { kind: 'note'; text: string; tone?: Tone }
export type DocContent = { title: string; blocks: DocBlock[] }

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const clean = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object' && !(value instanceof Date)) return '—'
  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          typeof value === 'bigint'
        ? String(value)
        : '—'
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, 2000)
}
const hasText = (value: unknown) => clean(value) !== '—'
const dateText = (value: unknown): string => {
  const parsed = value instanceof Date ? value : new Date(clean(value))
  if (!Number.isFinite(parsed.getTime())) return clean(value)
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(parsed)
      .map((part) => [part.type, part.value]),
  )
  return `${p.hour}:${p.minute}, ${p.day}/${p.month}/${p.year}`
}
/** DB lưu Decimal(…,2) nên có ".00"; bỏ phần thập phân toàn số 0, giữ nguyên phần lẻ thật. */
const amount = (value: unknown): string =>
  /^-?\d+(\.\d+)?$/.test(clean(value)) ? formatVndExact(clean(value).replace(/\.0+$/, '')) : clean(value)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Mã rút gọn giống web (8 ký tự cuối, viết hoa); giá trị không phải UUID giữ nguyên. */
const ref = (value: unknown): string => {
  const raw = clean(value)
  return UUID.test(raw) ? `#${raw.replace(/-/g, '').slice(-8).toUpperCase()}` : raw
}
const joined = (value: unknown): string =>
  arr(value).length
    ? arr(value)
        .map((item) => {
          const data = obj(item)
          return clean(data.label ?? data.name ?? data.description ?? data.type ?? item)
        })
        .join(', ')
    : '—'
const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  GOOD: 'Tốt',
  GOOD_USED: 'Đã qua sử dụng, tốt',
  FAIR: 'Khá',
  DAMAGED: 'Hư hỏng',
  LOST: 'Mất',
}
const OUTCOME_LABELS: Record<string, string> = {
  OBSERVED_RECEIVED: 'Đã nhận',
  OBSERVED_ISSUE: 'Có vấn đề',
  PASS: 'Đạt',
  ISSUE: 'Có vấn đề',
  NORMAL: 'Bình thường',
  DAMAGED: 'Hư hỏng',
  LOST: 'Mất',
}
const EVIDENCE_LABEL = 'Ảnh/bằng chứng: '
const WARN_VALUES = new Set(['DAMAGED', 'LOST', 'ISSUE', 'OBSERVED_ISSUE'])
const label = (map: Record<string, string>, value: unknown) => map[clean(value)] ?? clean(value)
const toneOf = (value: unknown): Tone | undefined => (WARN_VALUES.has(clean(value)) ? 'warn' : undefined)

export function documentContent(doc: RentalDocument): DocContent {
  const s = obj(doc.snapshotJson)
  const blocks: DocBlock[] = []
  const section = (title: string) => blocks.push({ kind: 'section', title })
  const fields = (items: Field[]) => blocks.push({ kind: 'fields', items })
  const note = (text: string, tone?: Tone) => blocks.push({ kind: 'note', text, tone })

  switch (doc.documentType) {
    case RentalDocumentType.HANDOVER: {
      const recipient = obj(s.recipient)
      const units = arr(s.units).map(obj)
      blocks.push({
        kind: 'highlights',
        items: [
          { label: 'Thời điểm giao', value: dateText(s.handedOverAt) },
          { label: 'Số thiết bị', value: `${units.length} thiết bị` },
          { label: 'Hạn trả', value: dateText(s.rentalEndAt) },
          { label: 'Tiền cọc', value: amount(s.totalDeposit), tone: 'accent' },
        ],
      })
      section('Thông tin đơn thuê')
      fields([
        { label: 'Mã đơn thuê', value: ref(s.orderId) },
        { label: 'Chuyến đi', value: ref(s.tripId) },
        { label: 'Bắt đầu thuê', value: dateText(s.rentalStartAt) },
        { label: 'Kết thúc thuê', value: dateText(s.rentalEndAt) },
        { label: 'Phí thuê', value: amount(s.rentalFee) },
        { label: 'Tổng tiền cọc', value: amount(s.totalDeposit) },
        { label: 'Điểm nhận đồ', value: ref(s.pickupPointId) },
      ])
      section('Bên giao và bên nhận')
      fields([
        { label: 'Người nhận', value: clean(recipient.displayName) },
        { label: 'Số điện thoại', value: clean(recipient.phone) },
        { label: 'Mã người nhận', value: ref(recipient.userId) },
        { label: 'Nhân viên giao', value: ref(s.staffId) },
      ])
      note('Khách xác nhận nhận đồ bằng mã nhận do nhân viên kiểm tra tại chỗ. Chứng từ không ghi nhận chữ ký điện tử của khách.')
      section(`Danh sách thiết bị bàn giao (${units.length})`)
      if (units.length) {
        blocks.push({
          kind: 'table',
          columns: [
            { title: 'STT', width: 32 },
            { title: 'Mã tài sản', width: 140 },
            { title: 'Tình trạng', width: 100 },
            { title: 'Phụ kiện kèm theo', width: 0 },
          ],
          rows: units.map((unit, i) => ({
            cells: [String(i + 1), clean(unit.assetCode), label(CONDITION_LABELS, unit.condition), joined(unit.accessories)],
            tones: [undefined, undefined, toneOf(unit.condition)],
            evidence: arr(unit.evidenceIds).map(clean),
          })),
        })
      } else note('Không có thiết bị trong dữ liệu bàn giao.', 'warn')
      const issues = arr(s.reportedIssues).map(obj)
      if (hasText(s.recipientNotes) || issues.length) {
        section('Ghi nhận khi bàn giao')
        if (hasText(s.recipientNotes)) fields([{ label: 'Ghi chú của người nhận', value: clean(s.recipientNotes), wide: true }])
        issues.forEach((issue, i) =>
          note(`Vấn đề ${i + 1}: ${clean(issue.type)} — ${clean(issue.description)}`, 'warn'),
        )
      }
      break
    }
    case RentalDocumentType.RETURN_RECEIPT: {
      const received = arr(s.receivedUnits).map(obj)
      const missing = arr(s.notReturnedUnitIdsAtSessionEnd)
      blocks.push({
        kind: 'highlights',
        items: [
          { label: 'Thời điểm nhận', value: dateText(s.finalizedAt) },
          { label: 'Đã nhận', value: `${received.length} thiết bị`, tone: 'success' },
          {
            label: 'Chưa trả',
            value: `${missing.length} thiết bị`,
            tone: missing.length ? 'warn' : 'success',
          },
        ],
      })
      section('Thông tin phiên nhận trả')
      fields([
        { label: 'Mã đơn thuê', value: ref(s.orderId) },
        { label: 'Phiên nhận trả', value: ref(s.returnSessionId) },
        { label: 'Điểm nhận trả', value: ref(s.returnLocationRef) },
        { label: 'Nhân viên nhận', value: ref(s.staffId) },
      ])
      section(`Thiết bị đã nhận (${received.length})`)
      if (received.length) {
        blocks.push({
          kind: 'table',
          columns: [
            { title: 'STT', width: 32 },
            { title: 'Mã tài sản', width: 120 },
            { title: 'Tình trạng sơ bộ', width: 95 },
            { title: 'Kết quả sơ bộ', width: 90 },
            { title: 'Phụ kiện', width: 0 },
          ],
          rows: received.map((unit, i) => ({
            cells: [
              String(i + 1),
              clean(unit.assetCode),
              label(CONDITION_LABELS, unit.condition),
              label(OUTCOME_LABELS, unit.outcome),
              joined(unit.accessories),
            ],
            tones: [undefined, undefined, toneOf(unit.condition), toneOf(unit.outcome)],
            details: [
              `Giờ quét: ${dateText(unit.receivedAt)}`,
              ...(hasText(unit.notes) ? [`Ghi chú: ${clean(unit.notes)}`] : []),
            ],
            evidence: arr(unit.evidenceIds).map(clean),
          })),
        })
      } else note('Không quét được thiết bị nào trong phiên này. Xem bằng chứng thu hồi thất bại bên dưới.', 'warn')
      if (missing.length) {
        section(`Thiết bị chưa trả (${missing.length})`)
        note(missing.map(ref).join(', '), 'warn')
      }
      if (hasText(s.remarks) || hasText(s.failureEvidenceId) || arr(s.evidenceIds).length) {
        section('Ghi chú và bằng chứng')
        fields([
          ...(hasText(s.remarks) ? [{ label: 'Ghi chú phiên nhận', value: clean(s.remarks), wide: true }] : []),
          ...(hasText(s.failureEvidenceId)
            ? [{ label: 'Bằng chứng thu hồi thất bại', value: '', evidence: [clean(s.failureEvidenceId)], wide: true }]
            : []),
          ...(arr(s.evidenceIds).length
            ? [{ label: 'Tham chiếu bằng chứng', value: '', evidence: arr(s.evidenceIds).map(clean), wide: true }]
            : []),
        ])
      }
      note('Tình trạng ghi trên biên nhận là kết quả sơ bộ khi nhận đồ. Kết luận kiểm định và hoàn cọc sẽ được thông báo riêng.')
      break
    }
    case RentalDocumentType.EXTENSION_APPENDIX: {
      const acceptance = obj(s.acceptance)
      blocks.push({
        kind: 'highlights',
        items: [
          { label: 'Kết thúc thuê cũ', value: dateText(s.oldRentalEndAt) },
          { label: 'Kết thúc thuê mới', value: dateText(s.newRentalEndAt), tone: 'success' },
          { label: 'Phí bổ sung', value: amount(s.additionalFee), tone: 'accent' },
        ],
      })
      section('Thay đổi thời hạn thuê')
      fields([
        { label: 'Mã đơn thuê', value: ref(s.orderId) },
        { label: 'Phụ lục số', value: clean(s.appendixNo) },
        { label: 'Hạn trả vận hành cũ', value: dateText(s.oldEffectiveOperationalDueAt) },
        { label: 'Hạn trả vận hành mới', value: dateText(s.newEffectiveOperationalDueAt) },
      ])
      section('Chấp nhận điều khoản')
      fields([
        { label: 'Thời điểm chấp nhận', value: dateText(acceptance.acceptedAt) },
        { label: 'Phiên bản điều khoản', value: clean(acceptance.acceptedTermsVersion) },
        { label: 'Dấu vết điều khoản', value: clean(acceptance.termsHash), wide: true },
      ])
      note('Biên bản bàn giao gốc giữ nguyên. Phụ lục này chỉ ghi phần thời hạn và phí đã thay đổi.')
      break
    }
    case RentalDocumentType.SCHEDULE_NOTICE:
      blocks.push({
        kind: 'highlights',
        items: [
          { label: 'Hạn trả trước đây', value: dateText(s.previousOperationalReturnDueAt) },
          { label: 'Hạn trả mới', value: dateText(s.operationalReturnDueAt), tone: 'accent' },
          { label: 'Phí thuê', value: 'Không thay đổi', tone: 'success' },
        ],
      })
      section('Thay đổi lịch trả')
      fields([
        { label: 'Mã đơn thuê', value: ref(s.orderId) },
        { label: 'Chuyến đi', value: ref(s.tripId) },
        { label: 'Hạn thuê theo hợp đồng', value: dateText(s.contractualRentalEndAt) },
        { label: 'Hạn trả vận hành mới', value: dateText(s.operationalReturnDueAt) },
      ])
      note('Thông báo này không thay đổi phí thuê hay biên bản bàn giao gốc.')
      break
    case RentalDocumentType.CORRECTION_NOTICE: {
      const corrections = arr(s.corrections).map(obj)
      blocks.push({
        kind: 'highlights',
        items: [
          { label: 'Chứng từ được đính chính', value: ref(s.sourceDocumentId) },
          { label: 'Số nội dung đính chính', value: String(corrections.length), tone: 'accent' },
        ],
      })
      section('Lý do đính chính')
      fields([
        { label: 'Lý do', value: clean(s.reason), wide: true },
        { label: 'SHA-256 snapshot gốc', value: clean(s.sourceSnapshotHash), wide: true },
      ])
      section('Nội dung đính chính')
      blocks.push({
        kind: 'table',
        columns: [
          { title: 'STT', width: 32 },
          { title: 'Trường', width: 130 },
          { title: 'Giá trị trước', width: 160 },
          { title: 'Giá trị sau', width: 0 },
        ],
        rows: corrections.map((c, i) => ({
          cells: [String(i + 1), clean(c.field), clean(c.oldValue), clean(c.newValue)],
          tones: [undefined, undefined, undefined, 'accent'],
        })),
      })
      note('Chứng từ gốc và dữ liệu gốc được giữ nguyên. Thông báo này là bản ghi bổ sung.')
      break
    }
  }
  return { title: headings[doc.documentType], blocks }
}

/** Văn bản thuần của chứng từ (để kiểm thử / tra cứu); cùng nội dung với PDF. */
export function documentText(doc: RentalDocument): string {
  const content = documentContent(doc)
  const out: string[] = [content.title]
  for (const block of content.blocks) {
    if (block.kind === 'highlights') block.items.forEach((h) => out.push(`${h.label}: ${h.value}`))
    else if (block.kind === 'section') out.push(block.title)
    else if (block.kind === 'fields')
      block.items.forEach((f) => out.push(`${f.label}: ${f.evidence ? f.evidence.map(ref).join(', ') : f.value}`))
    else if (block.kind === 'note') out.push(block.text)
    else {
      out.push(block.columns.map((c) => c.title).join(' | '))
      block.rows.forEach((r) =>
        out.push(
          r.cells.join(' | '),
          ...(r.details ?? []),
          ...(r.evidence?.length ? [`${EVIDENCE_LABEL}${r.evidence.map(ref).join(', ')}`] : []),
        ),
      )
    }
  }
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Bố cục trang
// ---------------------------------------------------------------------------

const PAGE_W = 595.28
const PAGE_H = 841.89
const ML = 40
const MR = PAGE_W - 40
const CW = MR - ML
const BOTTOM = 76

type Rgb = string
const C = {
  green: '0.122 0.369 0.231',
  greenSoft: '0.925 0.957 0.933',
  orange: '0.910 0.510 0.227',
  orangeSoft: '0.996 0.945 0.906',
  red: '0.725 0.180 0.169',
  redSoft: '0.992 0.925 0.922',
  text: '0.122 0.161 0.200',
  muted: '0.420 0.447 0.502',
  border: '0.851 0.886 0.863',
  zebra: '0.973 0.980 0.976',
  white: '1 1 1',
  link: '0.114 0.388 0.745',
}
const toneColor = (tone?: Tone): Rgb =>
  tone === 'accent' ? C.orange : tone === 'warn' ? C.red : tone === 'success' ? C.green : C.text
const toneSoft = (tone?: Tone): Rgb =>
  tone === 'accent' ? C.orangeSoft : tone === 'warn' ? C.redSoft : C.greenSoft
const toneBar = (tone?: Tone): Rgb => (tone === 'accent' ? C.orange : tone === 'warn' ? C.red : C.green)
const n = (v: number) => (Math.round(v * 100) / 100).toString()

/** Vùng bấm (toạ độ PDF) và URL cho annotation /Link của trang. */
type PdfLink = { rect: [number, number, number, number]; uri: string } | { rect: [number, number, number, number]; attachmentId: string }
export type RentalPdfEvidence = { id: string; bytes: Buffer; preview: Buffer; extension: string }
type Seg = { text: string; uri: string | null; dx: number; width: number }
type Unit = {
  height: number
  keepWithNext?: boolean
  tableHeader?: Unit
  draw: (top: number, links: PdfLink[]) => string
}

const logger = new Logger('RentalPdfRenderer')

async function loadLogo(): Promise<{ bytes: Buffer; width: number; height: number; components: number } | null> {
  try {
    const bytes = await readFile(LOGO_PATH)
    const info = parseJpeg(bytes)
    if (!info) throw new Error('UNSUPPORTED_LOGO_FORMAT')
    return { bytes, ...info }
  } catch (error) {
    // Thiếu logo không được làm hỏng chứng từ; chỉ in thiếu logo.
    logger.warn(`Rental PDF logo unavailable (${LOGO_PATH}): ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

@Injectable()
export class RentalPdfRenderer {
  async render(doc: RentalDocument, evidence: RentalPdfEvidence[] = []): Promise<Buffer> {
    if (!SUPPORTED_TEMPLATE_VERSIONS.has(doc.templateVersion) || snapshotHash(doc.snapshotJson) !== doc.snapshotHash)
      throw new Error('PDF_SNAPSHOT_INTEGRITY_OR_TEMPLATE_FAILED')
    const fontPath = envconfig.RENTAL_PDF_FONT_PATH ?? process.env.RENTAL_PDF_FONT_PATH ?? DEFAULT_FONT_PATH
    const font = parseFont(await readFile(fontPath))
    const logo = await loadLogo()
    const images = evidence.map((item, index) => {
      const dimensions = parseJpeg(item.preview)
      if (!dimensions) throw new Error('PDF_EVIDENCE_PREVIEW_INVALID')
      return { ...item, dimensions, name: `Evidence${index + 1}` }
    })
    const content = documentContent(doc)

    // --- đo chữ ---------------------------------------------------------
    const used = new Set<number>()
    const charCode = (char: string) => {
      const code = char.codePointAt(0)!
      return code <= 65535 ? code : 65533
    }
    const widthOf = (s: string, size: number) =>
      [...s].reduce((total, char) => {
        const code = charCode(char)
        used.add(code)
        return total + (font.width(font.glyph(code)) * size) / font.units
      }, 0)
    const wrap = (text: string, size: number, max: number, maxLines = 400): string[] => {
      const lines: string[] = []
      let current = ''
      for (const word of text.split(/\s+/).filter(Boolean)) {
        const proposed = current ? `${current} ${word}` : word
        if (widthOf(proposed, size) <= max) {
          current = proposed
          continue
        }
        if (current) lines.push(current)
        current = ''
        if (widthOf(word, size) <= max) {
          current = word
          continue
        }
        for (const char of word) {
          if (current && widthOf(current + char, size) > max) {
            lines.push(current)
            current = ''
          }
          current += char
        }
      }
      if (current || !lines.length) lines.push(current)
      if (lines.length > maxLines) throw new Error('PDF_LAYOUT_TOO_LARGE')
      return lines
    }
    const hex = (s: string) => [...s].map((ch) => charCode(ch).toString(16).padStart(4, '0')).join('')

    // --- lệnh vẽ ----------------------------------------------------------
    const text = (s: string, x: number, baseline: number, size: number, color: Rgb, bold = false) => {
      widthOf(s, size)
      const body = `${color} rg BT /F1 ${size} Tf ${n(x)} ${n(baseline)} Td <${hex(s)}> Tj ET`
      return bold ? `${color} RG 0.32 w 2 Tr ${body} 0 Tr` : body
    }
    const textRight = (s: string, right: number, baseline: number, size: number, color: Rgb, bold = false) =>
      text(s, right - widthOf(s, size), baseline, size, color, bold)
    const rect = (x: number, y: number, w: number, h: number, color: Rgb) =>
      `${color} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`
    const hline = (x1: number, x2: number, y: number, color: Rgb, width = 0.6) =>
      `${color} RG ${width} w ${n(x1)} ${n(y)} m ${n(x2)} ${n(y)} l S`

    /** Dòng mã bằng chứng: mỗi mã là một đoạn riêng để gắn link; xuống dòng giữa các mã. */
    const evidenceLines = (prefix: string, ids: string[], size: number, max: number): Seg[][] => {
      const parts: Array<{ text: string; uri: string | null }> = prefix ? [{ text: prefix, uri: null }] : []
      ids.forEach((id, i) => {
        parts.push({ text: ref(id), uri: rentalEvidenceLink(doc.id, id) })
        if (i < ids.length - 1) parts.push({ text: ', ', uri: null })
      })
      const lines: Seg[][] = [[]]
      let x = 0
      for (const part of parts) {
        const width = widthOf(part.text, size)
        if (x + width > max && lines[lines.length - 1].length && part.text !== ', ') {
          lines.push([])
          x = 0
        }
        lines[lines.length - 1].push({ ...part, dx: x, width })
        x += width
      }
      if (lines.length > 100) throw new Error('PDF_LAYOUT_TOO_LARGE')
      return lines
    }
    const drawSegs = (lines: Seg[][], x: number, firstBaseline: number, step: number, size: number,
      plain: Rgb, links: PdfLink[]) =>
      lines
        .flatMap((line, li) => {
          const baseline = firstBaseline - li * step
          return line.flatMap((seg) => {
            if (!seg.uri) return [text(seg.text, x + seg.dx, baseline, size, plain)]
            const x1 = x + seg.dx
            links.push({ rect: [x1, baseline - size * 0.3, x1 + seg.width, baseline + size * 0.85], uri: seg.uri })
            return [text(seg.text, x1, baseline, size, C.link), hline(x1, x1 + seg.width, baseline - 1.4, C.link, 0.4)]
          })
        })
        .join('\n')

    // --- khối -> đơn vị không tách trang ------------------------------------
    const units: Unit[] = []
    for (const block of content.blocks) {
      if (block.kind === 'highlights') {
        const gap = 8
        const count = block.items.length
        const cardW = (CW - gap * (count - 1)) / count
        const values = block.items.map((item) => wrap(item.value, 11.5, cardW - 20, 3))
        const lines = Math.max(...values.map((v) => v.length))
        const height = 18 + lines * 14 + 12
        units.push({
          height: height + 14,
          draw: (top) => {
            const y = top - 6 - height
            return block.items
              .map((item, i) => {
                const x = ML + i * (cardW + gap)
                const ops = [rect(x, y, cardW, height, toneSoft(item.tone)), rect(x, y, 3, height, toneBar(item.tone))]
                ops.push(text(item.label.toUpperCase(), x + 11, top - 6 - 15, 7, C.muted))
                values[i].forEach((line, li) =>
                  ops.push(text(line, x + 11, top - 6 - 31 - li * 14, 11.5, toneColor(item.tone), true)),
                )
                return ops.join('\n')
              })
              .join('\n')
          },
        })
      } else if (block.kind === 'section') {
        const title = block.title.toUpperCase()
        units.push({
          height: 34,
          keepWithNext: true,
          draw: (top) =>
            [
              rect(ML, top - 30, 3.5, 12, C.orange),
              text(title, ML + 10, top - 28.5, 10.5, C.green, true),
              hline(ML, MR, top - 34, C.border),
            ].join('\n'),
        })
      } else if (block.kind === 'fields') {
        const colW = (CW - 16) / 2
        const rows: Field[][] = []
        for (const field of block.items) {
          const last = rows[rows.length - 1]
          if (field.wide || !last || last.length === 2 || last[0].wide) rows.push([field])
          else last.push(field)
        }
        for (const row of rows) {
          const wrapped = row.map((f) => (f.evidence ? null : wrap(f.value, 10, f.wide ? CW : colW)))
          const segs = row.map((f) => (f.evidence ? evidenceLines('', f.evidence, 10, f.wide ? CW : colW) : null))
          const lineCount = (i: number) => wrapped[i]?.length ?? segs[i]?.length ?? 1
          const height = 14 + Math.max(...row.map((_, i) => lineCount(i))) * 13 + 4
          units.push({
            height,
            draw: (top, links) =>
              row
                .map((f, i) => {
                  const x = ML + i * (colW + 16)
                  const fieldSegs = segs[i]
                  const value = fieldSegs
                    ? drawSegs(fieldSegs, x, top - 24, 13, 10, C.text, links)
                    : (wrapped[i] ?? []).map((line, li) => text(line, x, top - 24 - li * 13, 10, toneColor(f.tone))).join('\n')
                  return [text(f.label, x, top - 11, 7.5, C.muted), value].join('\n')
                })
                .join('\n'),
          })
        }
      } else if (block.kind === 'note') {
        const lines = wrap(block.text, 8.5, CW - 24)
        const height = lines.length * 11.5 + 13
        units.push({
          height: height + 10,
          draw: (top) => {
            const y = top - 6 - height
            return [
              rect(ML, y, CW, height, block.tone === 'warn' ? C.redSoft : C.greenSoft),
              rect(ML, y, 2.5, height, block.tone === 'warn' ? C.red : C.green),
              ...lines.map((line, i) =>
                text(line, ML + 12, top - 6 - 15 - i * 11.5, 8.5, block.tone === 'warn' ? C.red : C.text),
              ),
            ].join('\n')
          },
        })
      } else {
        const fixed = block.columns.reduce((sum, c) => sum + c.width, 0)
        const widths = block.columns.map((c) => (c.width || CW - fixed))
        const xs = widths.map((_, i) => ML + widths.slice(0, i).reduce((a, b) => a + b, 0))
        const header: Unit = {
          height: 22,
          draw: (top) =>
            [
              rect(ML, top - 20, CW, 20, C.green),
              ...block.columns.map((c, i) => text(c.title.toUpperCase(), xs[i] + 6, top - 13.5, 7.5, C.white, true)),
            ].join('\n'),
        }
        units.push({ ...header, keepWithNext: true })
        block.rows.forEach((row, index) => {
          const cells = row.cells.map((cell, i) => wrap(cell, 9, widths[i] - 12))
          const details = (row.details ?? []).flatMap((d) => wrap(d, 7.5, CW - 44))
          const evidence = row.evidence?.length ? evidenceLines(EVIDENCE_LABEL, row.evidence, 7.5, CW - 44) : []
          const height = 8 + Math.max(...cells.map((c) => c.length)) * 12 + (details.length + evidence.length) * 10.5 + 6
          units.push({
            height,
            tableHeader: header,
            draw: (top, links) => {
              const ops: string[] = []
              if (index % 2 === 1) ops.push(rect(ML, top - height, CW, height, C.zebra))
              cells.forEach((lines, i) =>
                lines.forEach((line, li) =>
                  ops.push(
                    text(line, xs[i] + 6, top - 15 - li * 12, 9, toneColor(row.tones?.[i]), i === 1),
                  ),
                ),
              )
              const detailTop = top - 15 - (Math.max(...cells.map((c) => c.length)) - 1) * 12 - 12.5
              details.forEach((line, li) => ops.push(text(line, xs[1] + 6, detailTop - li * 10.5, 7.5, C.muted)))
              if (evidence.length)
                ops.push(drawSegs(evidence, xs[1] + 6, detailTop - details.length * 10.5, 10.5, 7.5, C.muted, links))
              ops.push(hline(ML, MR, top - height, C.border, 0.5))
              return ops.join('\n')
            },
          })
        })
      }
    }

    if (images.length) {
      units.push({ height: 34, keepWithNext: true, draw: top =>
        [rect(ML, top - 30, 3.5, 12, C.orange), text('ẢNH BẰNG CHỨNG', ML + 10, top - 28.5, 10.5, C.green, true), hline(ML, MR, top - 34, C.border)].join('\n') })
      for (const image of images) {
        const scale = Math.min(210 / image.dimensions.width, 160 / image.dimensions.height)
        const width = image.dimensions.width * scale, height = image.dimensions.height * scale
        units.push({ height: height + 42, draw: (top, links) => {
          const bottom = top - height - 24
          links.push({ rect: [ML, bottom, ML + width, bottom + height], attachmentId: image.id })
          return [text(`Ảnh ${ref(image.id)} — mở tệp đính kèm để xem ảnh gốc`, ML, top - 13, 9, C.text),
            `q ${n(width)} 0 0 ${n(height)} ${n(ML)} ${n(bottom)} cm /${image.name} Do Q`].join('\n')
        } })
      }
    }

    // --- dàn trang -------------------------------------------------------
    const firstTop = 724
    const nextTop = 784
    const pages: string[][] = [[]]
    const pageLinks: PdfLink[][] = [[]]
    let y = firstTop
    let lastHeader: Unit | undefined
    for (let i = 0; i < units.length; i++) {
      const unit = units[i]
      const capacity = nextTop - BOTTOM - 22
      if (unit.height > capacity) throw new Error('PDF_ITEM_GROUP_TOO_LARGE')
      let needed = unit.height
      // Tiêu đề mục/bảng không được nằm một mình cuối trang.
      for (let j = i; units[j]?.keepWithNext && units[j + 1]; j++) needed += units[j + 1].height
      if (y - needed < BOTTOM && pages[pages.length - 1].length) {
        pages.push([])
        pageLinks.push([])
        y = nextTop
        if (unit.tableHeader && unit.tableHeader === lastHeader) {
          pages[pages.length - 1].push(unit.tableHeader.draw(y, pageLinks[pageLinks.length - 1]))
          y -= unit.tableHeader.height
        }
      }
      pages[pages.length - 1].push(unit.draw(y, pageLinks[pageLinks.length - 1]))
      y -= unit.height
      lastHeader = unit.tableHeader ?? (unit.keepWithNext && units[i + 1]?.tableHeader ? units[i + 1].tableHeader : lastHeader)
    }
    if (pages.length > 500) throw new Error('PDF_LAYOUT_TOO_LARGE')

    // --- đầu trang / chân trang ------------------------------------------
    const logoH = 62
    const logoW = logo ? (logo.width / logo.height) * logoH : 0
    const brandX = logo ? ML + logoW + 12 : ML
    const titleLines = wrap(content.title, 14, MR - 300, 2)
    const firstHeader = [
      ...(logo ? [`q ${n(logoW)} 0 0 ${logoH} ${ML} ${n(808 - logoH)} cm /Im1 Do Q`] : []),
      text('VINA TREKGO', brandX, 784, 15, C.green, true),
      text('Dịch vụ thuê thiết bị trekking', brandX, 769, 8.5, C.muted),
      ...titleLines.map((line, i) => textRight(line, MR, 790 - i * 17, 14, C.green, true)),
      textRight(`Số: ${doc.documentNumber}`, MR, 790 - titleLines.length * 17 - 1, 8, C.muted),
      textRight(`Ngày lập: ${dateText(doc.issuedAt)}`, MR, 790 - titleLines.length * 17 - 12, 8, C.muted),
      rect(ML, 736, CW, 2.5, C.orange),
    ].join('\n')
    const nextHeader = [
      text(`VINA TREKGO  ·  ${content.title}`, ML, 808, 8.5, C.green, true),
      textRight(`Số: ${doc.documentNumber}`, MR, 808, 7.5, C.muted),
      hline(ML, MR, 800, C.border),
    ].join('\n')
    const footer = (index: number) =>
      [
        hline(ML, MR, 58, C.border),
        text(`Mã xác thực (SHA-256): ${doc.snapshotHash}`, ML, 46, 6.8, C.muted),
        textRight(`Trang ${index + 1}/${pages.length}`, MR, 46, 8, C.text, true),
        text(
          `Mẫu ${clean(doc.templateVersion)} · Chính sách ${clean(doc.policyVersion)} · Giờ Việt Nam (GMT+7) · Chứng từ lập tự động, không có chữ ký điện tử của khách.`,
          ML,
          35,
          6.8,
          C.muted,
        ),
      ].join('\n')
    const pageStreams = pages.map((ops, index) =>
      [index === 0 ? firstHeader : nextHeader, ...ops, footer(index)].join('\n'),
    )

    // --- ghi PDF -----------------------------------------------------------
    const objs: Array<Buffer | null> = []
    const reserve = () => {
      objs.push(null)
      return objs.length
    }
    const set = (id: number, data: Buffer | string) => {
      objs[id - 1] = Buffer.isBuffer(data) ? data : Buffer.from(data, 'ascii')
    }
    const add = (data: Buffer | string) => {
      const id = reserve()
      set(id, data)
      return id
    }
    const stream = (bytes: Buffer) => {
      const compressed = deflateSync(bytes)
      return add(
        Buffer.concat([
          Buffer.from(`<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`),
          compressed,
          Buffer.from('\nendstream'),
        ]),
      )
    }
    const cidMap = Buffer.alloc(131072)
    for (const code of used) if (code <= 65535) cidMap.writeUInt16BE(font.glyph(code) & 65535, code * 2)
    const cidMapId = stream(cidMap),
      fontFileId = stream(font.bytes)
    const scale = (v: number) => Math.round((v * 1000) / font.units)
    const descriptor = add(
      `<< /Type /FontDescriptor /FontName /RentalUnicode /Flags 4 /FontBBox [${font.bbox.map(scale).join(' ')}] /ItalicAngle 0 /Ascent ${scale(font.ascent)} /Descent ${scale(font.descent)} /CapHeight ${scale(font.ascent)} /StemV 80 /FontFile2 ${fontFileId} 0 R >>`,
    )
    const sortedCodes = [...used].filter((c) => c <= 65535).sort((a, b) => a - b)
    const widths = sortedCodes.map((c) => `${c} [${scale(font.width(font.glyph(c)))}]`).join(' ')
    const descendant = add(
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /RentalUnicode /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /W [${widths}] /CIDToGIDMap ${cidMapId} 0 R >>`,
    )
    const unicode = sortedCodes.map((c) => {
      const code = c.toString(16).padStart(4, '0').toUpperCase()
      return `<${code}> <${code}>`
    })
    const blocks: string[] = []
    for (let i = 0; i < unicode.length; i += 100) {
      const part = unicode.slice(i, i + 100)
      blocks.push(`${part.length} beginbfchar\n${part.join('\n')}\nendbfchar`)
    }
    const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /RentalToUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${blocks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`
    const cmapId = stream(Buffer.from(cmap, 'ascii'))
    const fontId = add(
      `<< /Type /Font /Subtype /Type0 /BaseFont /RentalUnicode /Encoding /Identity-H /DescendantFonts [${descendant} 0 R] /ToUnicode ${cmapId} 0 R >>`,
    )
    const logoId = logo
      ? add(
          Buffer.concat([
            Buffer.from(
              `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /${logo.components === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`,
            ),
            logo.bytes,
            Buffer.from('\nendstream'),
          ]),
        )
      : null
    const imageIds = new Map<string, number>()
    const attachmentIds = new Map<string, number>()
    for (const item of images) {
      imageIds.set(item.name, add(Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${item.dimensions.width} /Height ${item.dimensions.height} /ColorSpace /${item.dimensions.components === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${item.preview.length} >>\nstream\n`),
        item.preview, Buffer.from('\nendstream'),
      ])))
      const embeddedId = add(Buffer.concat([Buffer.from(`<< /Type /EmbeddedFile /Length ${item.bytes.length} >>\nstream\n`), item.bytes, Buffer.from('\nendstream')]))
      const filename = `evidence-${item.id}.${item.extension}`
      attachmentIds.set(item.id, add(`<< /Type /Filespec /F (${filename}) /UF (${filename}) /EF << /F ${embeddedId} 0 R >> >>`))
    }
    const pagesId = reserve()
    // URL chỉ gồm ký tự an toàn của URL; vẫn escape ký tự đặc biệt của chuỗi PDF cho chắc.
    const pdfString = (value: string) => value.replace(/[\\()]/g, (ch) => `\\${ch}`)
    const pageIds = pageStreams.map((ops, index) => {
      const contentId = stream(Buffer.from(ops, 'ascii'))
      const imageRefs = [...imageIds].map(([name, id]) => `/${name} ${id} 0 R`).join(' ')
      const xobject = logoId || imageRefs ? ` /XObject << ${logoId ? `/Im1 ${logoId} 0 R` : ''} ${imageRefs} >>` : ''
      const annotIds = pageLinks[index].map((link) =>
        'attachmentId' in link ? add(`<< /Type /Annot /Subtype /FileAttachment /Rect [${link.rect.map(n).join(' ')}] /FS ${attachmentIds.get(link.attachmentId)} 0 R /Name /PushPin /Contents (Open original image attachment) >>`) : add(
          `<< /Type /Annot /Subtype /Link /Rect [${link.rect.map(n).join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${pdfString(link.uri)}) >> >>`,
        ),
      )
      const annots = annotIds.length ? ` /Annots [${annotIds.map((id) => `${id} 0 R`).join(' ')}]` : ''
      return add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontId} 0 R >>${xobject} >> /Contents ${contentId} 0 R${annots} >>`,
      )
    })
    set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)
    const names = images.length ? ` /Names << /EmbeddedFiles << /Names [${[...images].sort((a, b) => a.id.localeCompare(b.id)).map(item => `(evidence-${item.id}.${item.extension}) ${attachmentIds.get(item.id)} 0 R`).join(' ')}] >> >>` : ''
    const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R${names} >>`)
    const chunks: Buffer[] = [Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'binary')]
    const offsets = [0]
    let byteOffset = chunks[0].length
    for (let i = 0; i < objs.length; i++) {
      offsets.push(byteOffset)
      const part = [Buffer.from(`${i + 1} 0 obj\n`), objs[i]!, Buffer.from('\nendobj\n')]
      chunks.push(...part)
      byteOffset += part.reduce((total, b) => total + b.length, 0)
    }
    chunks.push(
      Buffer.from(
        `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets
          .slice(1)
          .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
          .join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${byteOffset}\n%%EOF`,
      ),
    )
    return Buffer.concat(chunks)
  }
}
