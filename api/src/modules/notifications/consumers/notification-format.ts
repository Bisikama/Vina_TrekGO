/** Định dạng hiển thị dùng chung cho nội dung thông báo (giờ Việt Nam, tiền VND). */

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const vndFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

export function formatDateTimeVi(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_NOTIFICATION_DATE')
  return dateTimeFormatter.format(date)
}

export function formatVnd(amount: string | number): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) throw new Error('INVALID_NOTIFICATION_AMOUNT')
  return vndFormatter.format(value)
}

/** Mã ngắn hiển thị cho khách, ví dụ `#1a2b3c4d`. */
export function shortRef(id: string): string {
  return `#${id.slice(0, 8)}`
}
