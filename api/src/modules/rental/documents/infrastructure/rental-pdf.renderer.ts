import envconfig from 'src/shared/config';
import { Injectable } from '@nestjs/common'
import { readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import { RentalDocument, RentalDocumentType } from '@prisma/client'
import { snapshotHash } from '../application/rental-document-events'

const headings: Record<RentalDocumentType, string> = {
  HANDOVER: 'BIÊN BẢN BÀN GIAO THIẾT BỊ',
  EXTENSION_APPENDIX: 'PHỤ LỤC GIA HẠN THUÊ',
  RETURN_RECEIPT: 'BIÊN NHẬN THU HỒI THIẾT BỊ',
  SCHEDULE_NOTICE: 'THÔNG BÁO THAY ĐỔI LỊCH',
  CORRECTION_NOTICE: 'THÔNG BÁO ĐÍNH CHÍNH',
}

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

type PdfLine = { text: string; kind: 'title' | 'section' | 'normal'; group?: string }
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
const dateText = (value: unknown): string => {
  const parsed = value instanceof Date ? value : new Date(clean(value))
  return Number.isFinite(parsed.getTime())
    ? `${new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed)} (Asia/Ho_Chi_Minh)`
    : clean(value)
}
const amount = (value: unknown): string =>
  /^-?\d+(\.\d+)?$/.test(clean(value)) ? formatVndExact(clean(value)) : clean(value)
const joined = (value: unknown): string =>
  arr(value).length
    ? arr(value)
        .map((item) => {
          const data = obj(item)
          return clean(data.label ?? data.name ?? data.description ?? data.type ?? item)
        })
        .join(', ')
    : '—'

/** Whitelisted semantic fields only; never serialize the raw policy or an arbitrary snapshot key. */
export function documentLines(doc: RentalDocument): PdfLine[] {
  const s = obj(doc.snapshotJson)
  const lines: PdfLine[] = []
  const line = (text: string, kind: PdfLine['kind'] = 'normal', group?: string) => lines.push({ text, kind, group })
  const field = (label: string, value: unknown, group?: string) => line(`${label}: ${clean(value)}`, 'normal', group)
  const section = (title: string, group?: string) => {
    line('', 'normal', group)
    line(title, 'section', group)
  }
  line(headings[doc.documentType], 'title')
  field('Số chứng từ', doc.documentNumber)
  field('Phát hành', dateText(doc.issuedAt))
  line(`Phiên bản mẫu PDF: ${clean(doc.templateVersion)} | Chính sách ghi trên chứng từ: ${clean(doc.policyVersion)}`)

  switch (doc.documentType) {
    case RentalDocumentType.HANDOVER: {
      const recipient = obj(s.recipient)
      section('THÔNG TIN BÀN GIAO')
      field('Đơn thuê', s.orderId)
      field('Chuyến đi', s.tripId)
      field('Thời điểm giao', dateText(s.handedOverAt))
      field('Điểm nhận (mã tham chiếu)', s.pickupPointId)
      section('NGƯỜI GIAO VÀ NGƯỜI NHẬN')
      field('Nhân viên giao (mã)', s.staffId)
      field('Người nhận', recipient.displayName)
      field('Số điện thoại', recipient.phone)
      field('Người nhận (mã)', recipient.userId)
      line('Xác nhận nhận hàng: nhân viên kiểm tra mã nhận; không ghi nhận chữ ký điện tử của khách.')
      section('DANH SÁCH THIẾT BỊ ĐÃ GIAO', arr(s.units).length ? 'handover-unit-0' : undefined)
      arr(s.units).forEach((value, i) => {
        const unit = obj(value)
        const group = `handover-unit-${i}`
        line(`${i + 1}. Mã tài sản: ${clean(unit.assetCode)} | Tình trạng: ${clean(unit.condition)}`, 'normal', group)
        line(`   Phụ kiện: ${joined(unit.accessories)} | Bằng chứng: ${joined(unit.evidenceIds)}`, 'normal', group)
      })
      if (!arr(s.units).length) line('Không có thiết bị trong snapshot.')
      section('THỜI HẠN, PHÍ VÀ GHI NHẬN')
      field('Bắt đầu thuê', dateText(s.rentalStartAt))
      field('Kết thúc thuê', dateText(s.rentalEndAt))
      field('Phí thuê', amount(s.rentalFee))
      field('Tổng tiền cọc', amount(s.totalDeposit))
      field('Ghi chú người nhận', s.recipientNotes)
      arr(s.reportedIssues).forEach((value, i) => {
        const issue = obj(value)
        line(`Vấn đề ${i + 1}: ${clean(issue.type)} - ${clean(issue.description)}`)
      })
      break
    }
    case RentalDocumentType.RETURN_RECEIPT: {
      section('THÔNG TIN NHẬN TRẢ')
      field('Đơn thuê', s.orderId)
      field('Phiên nhận trả', s.returnSessionId)
      field('Thời điểm nhận', dateText(s.finalizedAt))
      field('Điểm nhận trả (tham chiếu)', s.returnLocationRef)
      field('Nhân viên nhận (mã)', s.staffId)
      section('THIẾT BỊ ĐÃ NHẬN TRONG PHIÊN NÀY', arr(s.receivedUnits).length ? 'return-unit-0' : undefined)
      arr(s.receivedUnits).forEach((value, i) => {
        const unit = obj(value)
        const group = `return-unit-${i}`
        line(
          `${i + 1}. Mã tài sản: ${clean(unit.assetCode)} | Tình trạng sơ bộ: ${clean(unit.condition)}`,
          'normal',
          group,
        )
        line(`   Giờ quét: ${dateText(unit.receivedAt)} | Kết quả sơ bộ: ${clean(unit.outcome)}`, 'normal', group)
        line(`   Phụ kiện: ${joined(unit.accessories)} | Bằng chứng: ${joined(unit.evidenceIds)}`, 'normal', group)
        if (unit.notes) field('   Ghi chú thiết bị', unit.notes, group)
      })
      if (!arr(s.receivedUnits).length) line('Không quét được thiết bị; xem bằng chứng thu hồi thất bại bên dưới.')
      section('THIẾT BỊ CHƯA GHI NHẬN TRẢ')
      line(joined(s.notReturnedUnitIdsAtSessionEnd))
      section('GHI CHÚ VÀ BẰNG CHỨNG')
      field('Ghi chú phiên nhận', s.remarks)
      field('Bằng chứng thu hồi thất bại', s.failureEvidenceId)
      field('Tham chiếu bằng chứng', joined(s.evidenceIds))
      line('Biên nhận này ghi tình trạng sơ bộ; không phải kết luận kiểm định cuối hoặc xác nhận hoàn cọc.')
      break
    }
    case RentalDocumentType.EXTENSION_APPENDIX: {
      const acceptance = obj(s.acceptance)
      section('THAY ĐỔI THỜI HẠN THUÊ')
      field('Đơn thuê', s.orderId)
      field('Phụ lục số', s.appendixNo)
      field('Kết thúc thuê cũ', dateText(s.oldRentalEndAt))
      field('Kết thúc thuê mới', dateText(s.newRentalEndAt))
      field('Hạn trả vận hành cũ', dateText(s.oldEffectiveOperationalDueAt))
      field('Hạn trả vận hành mới', dateText(s.newEffectiveOperationalDueAt))
      section('PHÍ BỔ SUNG VÀ CHẤP NHẬN')
      field('Phí bổ sung', amount(s.additionalFee))
      field('Thời điểm chấp nhận', dateText(acceptance.acceptedAt))
      field('Phiên bản điều khoản đã chấp nhận', acceptance.acceptedTermsVersion)
      field('Dấu vết điều khoản', acceptance.termsHash)
      line('Biên bản bàn giao gốc giữ nguyên; phụ lục chỉ ghi thay đổi đã được áp dụng.')
      break
    }
    case RentalDocumentType.SCHEDULE_NOTICE:
      section('THAY ĐỔI LỊCH VẬN HÀNH')
      field('Đơn thuê', s.orderId)
      field('Chuyến đi', s.tripId)
      field('Hạn thuê theo hợp đồng', dateText(s.contractualRentalEndAt))
      field('Hạn trả vận hành trước', dateText(s.previousOperationalReturnDueAt))
      field('Hạn trả vận hành mới', dateText(s.operationalReturnDueAt))
      line('Thông báo này không thay đổi phí thuê hoặc chứng từ bàn giao gốc.')
      break
    case RentalDocumentType.CORRECTION_NOTICE:
      section('CHỨNG TỪ GỐC VÀ LÝ DO')
      field('Chứng từ được đính chính (mã)', s.sourceDocumentId)
      field('SHA-256 snapshot gốc', s.sourceSnapshotHash)
      field('Lý do đính chính', s.reason)
      section('NỘI DUNG ĐÍNH CHÍNH')
      arr(s.corrections).forEach((value, i) => {
        const correction = obj(value)
        line(`${i + 1}. Trường: ${clean(correction.field)}`)
        field('   Giá trị trước', correction.oldValue)
        field('   Giá trị sau', correction.newValue)
      })
      line('Chứng từ gốc và snapshot gốc được giữ nguyên; thông báo này là bản ghi bổ sung.')
      break
  }
  if (lines.length > 10_000) throw new Error('PDF_SNAPSHOT_TOO_LARGE')
  line('')
  line(`SHA-256 snapshot: ${doc.snapshotHash}`)
  line('Chứng từ được lập từ dữ liệu giao dịch đã ghi nhận; không tự tạo chữ ký khách hàng.')
  return lines
}

@Injectable()
export class RentalPdfRenderer {
  async render(doc: RentalDocument): Promise<Buffer> {
    if (doc.templateVersion !== '1.3.2' || snapshotHash(doc.snapshotJson) !== doc.snapshotHash)
      throw new Error('PDF_SNAPSHOT_INTEGRITY_OR_TEMPLATE_FAILED')
    const fontPath = envconfig.RENTAL_PDF_FONT_PATH ?? process.env.RENTAL_PDF_FONT_PATH
    if (!fontPath) throw new Error('RENTAL_PDF_FONT_PATH_REQUIRED')
    const font = parseFont(await readFile(fontPath))
    const used = new Set<number>()
    const widthOf = (s: string) =>
      [...s].reduce((n, char) => {
        const code = char.codePointAt(0)!
        used.add(code <= 65535 ? code : 65533)
        return n + (font.width(font.glyph(code)) * 10) / font.units
      }, 0)
    const wrapped: PdfLine[] = []
    for (const line of documentLines(doc)) {
      if (!line.text) {
        wrapped.push(line)
        continue
      }
      let current = ''
      const limit = line.kind === 'title' ? 350 : line.kind === 'section' ? 450 : 500
      for (const word of line.text.split(/\s+/)) {
        const proposed = current ? `${current} ${word}` : word
        if (widthOf(proposed) <= limit) {
          current = proposed
          continue
        }
        if (current) {
          wrapped.push({ text: current, kind: line.kind, group: line.group })
          current = ''
        }
        if (widthOf(word) <= limit) {
          current = word
          continue
        }
        for (const char of word) {
          if (widthOf(current + char) > limit && current) {
            wrapped.push({ text: current, kind: line.kind, group: line.group })
            current = ''
          }
          current += char
        }
      }
      if (current) wrapped.push({ text: current, kind: line.kind, group: line.group })
    }
    if (wrapped.length > 20_000) throw new Error('PDF_LAYOUT_TOO_LARGE')
    const lineHeight = (line: PdfLine) => (line.kind === 'title' ? 25 : line.kind === 'section' ? 23 : 15)
    const pages: PdfLine[][] = [[]]
    let pageHeight = 0
    for (let i = 0; i < wrapped.length;) {
      const group = wrapped[i].group
      let end = i + 1
      if (group) while (end < wrapped.length && wrapped[end].group === group) end++
      const block = wrapped.slice(i, end)
      const height = block.reduce((total, item) => total + lineHeight(item), 0)
      if (height > 715) throw new Error('PDF_ITEM_GROUP_TOO_LARGE')
      if (pageHeight + height > 715) {
        pages.push([])
        pageHeight = 0
      }
      pages[pages.length - 1].push(...block)
      pageHeight += height
      i = end
    }
    widthOf('Trang 0000/0000')
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
    const scale = (n: number) => Math.round((n * 1000) / font.units)
    const descriptor = add(
      `<< /Type /FontDescriptor /FontName /RentalUnicode /Flags 4 /FontBBox [${font.bbox.map(scale).join(' ')}] /ItalicAngle 0 /Ascent ${scale(font.ascent)} /Descent ${scale(font.descent)} /CapHeight ${scale(font.ascent)} /StemV 80 /FontFile2 ${fontFileId} 0 R >>`,
    )
    const widths = [...used]
      .filter((c) => c <= 65535)
      .sort((a, b) => a - b)
      .map((c) => `${c} [${scale(font.width(font.glyph(c)))}]`)
      .join(' ')
    const descendant = add(
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /RentalUnicode /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /W [${widths}] /CIDToGIDMap ${cidMapId} 0 R >>`,
    )
    const unicode = [...used]
      .filter((c) => c <= 65535)
      .sort((a, b) => a - b)
      .map((c) => {
        const hex = c.toString(16).padStart(4, '0').toUpperCase()
        return `<${hex}> <${hex}>`
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
    const pagesId = reserve()
    const pageIds = pages.map((page, index) => {
      let y = 790
      const content =
        page
          .map((line) => {
            const hex = [...line.text]
              .map((ch) => (ch.codePointAt(0)! <= 65535 ? ch.codePointAt(0)! : 65533).toString(16).padStart(4, '0'))
              .join('')
            const size = line.kind === 'title' ? 14 : line.kind === 'section' ? 11 : 10
            const color = line.kind === 'normal' ? '0 g' : '0.13 0.25 0.37 rg'
            const command =
              `${color} BT /F1 ${size} Tf 48 ${y} Td <${hex}> Tj ET` +
              (line.kind === 'section' ? `\n0.65 G 0.5 w 48 ${y - 5} m 547 ${y - 5} l S` : '')
            y -= lineHeight(line)
            return command
          })
          .join('\n') +
        `\n0 g BT /F1 9 Tf 48 35 Td <${[...`Trang ${index + 1}/${pages.length}`].map((c) => c.codePointAt(0)!.toString(16).padStart(4, '0')).join('')}> Tj ET`
      const contentId = stream(Buffer.from(content, 'ascii'))
      return add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      )
    })
    set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)
    const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
    const chunks: Buffer[] = [Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'binary')]
    const offsets = [0]
    for (let i = 0; i < objs.length; i++) {
      offsets.push(Buffer.concat(chunks).length)
      chunks.push(Buffer.from(`${i + 1} 0 obj\n`), objs[i]!, Buffer.from('\nendobj\n'))
    }
    const xrefAt = Buffer.concat(chunks).length
    chunks.push(
      Buffer.from(
        `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets
          .slice(1)
          .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
          .join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`,
      ),
    )
    return Buffer.concat(chunks)
  }
}
