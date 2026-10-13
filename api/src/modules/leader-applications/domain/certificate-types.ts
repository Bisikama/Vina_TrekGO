export const CERTIFICATE_TYPES = [
  { code: 'FIRST_AID', label: 'Sơ cứu' },
  { code: 'TOUR_GUIDING', label: 'Hướng dẫn du lịch' },
  { code: 'OUTDOOR_SAFETY', label: 'An toàn hoạt động ngoài trời' },
  { code: 'RESCUE', label: 'Cứu hộ' },
  { code: 'OTHER', label: 'Loại khác' },
] as const

export function encodeCertificateType(code: string, other?: string | null) {
  return code === 'OTHER' ? `OTHER:${other!.trim()}` : code
}

export function decodeCertificateType(value: string) {
  return value.startsWith('OTHER:')
    ? { typeCode: 'OTHER', otherTypeName: value.slice(6) }
    : { typeCode: value, otherTypeName: null }
}
