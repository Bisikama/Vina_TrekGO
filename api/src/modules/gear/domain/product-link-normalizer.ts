/**
 * Chuẩn hoá link sản phẩm để cùng một trang không bị tính là nguồn mới chỉ vì tham số theo dõi.
 * Chỉ dùng cho hiển thị và khoá cache; trang vẫn được đọc theo link gốc người dùng dán.
 */

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'msclkid',
  'yclid',
  'ttclid',
  'twclid',
  'igshid',
  'srsltid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'ref',
  'ref_',
  'ref_src',
  'spm',
  'scm',
  'sp_atk',
  'xptdk',
])

function isTrackingParam(name: string): boolean {
  const key = name.toLowerCase()
  return key.startsWith('utm_') || TRACKING_PARAMS.has(key)
}

export interface NormalizedProductLink {
  /** Link đã bỏ #, bỏ tham số theo dõi và sắp xếp query; lưu vào bản nháp. */
  displayUrl: string
  /** Như displayUrl nhưng bỏ thêm `www.` và `/` cuối; chỉ dùng để băm khoá cache. */
  cacheKeyUrl: string
}

export function normalizeProductLink(rawUrl: string): NormalizedProductLink {
  const url = new URL(rawUrl.trim())
  const host = url.host.toLowerCase()

  const params = [...url.searchParams.entries()]
    .filter(([name]) => !isTrackingParam(name))
    .sort(([aKey, aVal], [bKey, bVal]) =>
      aKey === bKey ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) : aKey < bKey ? -1 : 1,
    )
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : ''

  const displayUrl = `${url.protocol}//${host}${url.pathname}${query}`

  const keyHost = host.startsWith('www.') ? host.slice(4) : host
  const keyPath = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') || '/' : url.pathname
  const cacheKeyUrl = `${url.protocol}//${keyHost}${keyPath}${query}`

  return { displayUrl, cacheKeyUrl }
}
