/**
 * Mapping WMO Weather Interpretation Codes (0-99)
 * Specification: https://open-meteo.com/en/docs
 */
export interface WmoWeatherDescription {
  code: number
  descriptionVi: string
  descriptionEn: string
  isRain: boolean
  isStorm: boolean
  isFog: boolean
  isSnow: boolean
}

export const WMO_CODE_TABLE: Record<number, Omit<WmoWeatherDescription, 'code'>> = {
  0: { descriptionVi: 'Trời quang đãng', descriptionEn: 'Clear sky', isRain: false, isStorm: false, isFog: false, isSnow: false },
  1: { descriptionVi: 'Trời ít mây', descriptionEn: 'Mainly clear', isRain: false, isStorm: false, isFog: false, isSnow: false },
  2: { descriptionVi: 'Mây rải rác', descriptionEn: 'Partly cloudy', isRain: false, isStorm: false, isFog: false, isSnow: false },
  3: { descriptionVi: 'Trời nhiều mây, u ám', descriptionEn: 'Overcast', isRain: false, isStorm: false, isFog: false, isSnow: false },
  45: { descriptionVi: 'Sương mù', descriptionEn: 'Fog', isRain: false, isStorm: false, isFog: true, isSnow: false },
  48: { descriptionVi: 'Sương mù dày đặc', descriptionEn: 'Depositing rime fog', isRain: false, isStorm: false, isFog: true, isSnow: false },
  51: { descriptionVi: 'Mưa phùn nhẹ', descriptionEn: 'Light drizzle', isRain: true, isStorm: false, isFog: false, isSnow: false },
  53: { descriptionVi: 'Mưa phùn vừa', descriptionEn: 'Moderate drizzle', isRain: true, isStorm: false, isFog: false, isSnow: false },
  55: { descriptionVi: 'Mưa phùn hạt dày', descriptionEn: 'Dense drizzle', isRain: true, isStorm: false, isFog: false, isSnow: false },
  56: { descriptionVi: 'Mưa phùn lạnh buốt', descriptionEn: 'Light freezing drizzle', isRain: true, isStorm: false, isFog: false, isSnow: false },
  57: { descriptionVi: 'Mưa phùn băng giá', descriptionEn: 'Dense freezing drizzle', isRain: true, isStorm: false, isFog: false, isSnow: false },
  61: { descriptionVi: 'Mưa nhẹ', descriptionEn: 'Slight rain', isRain: true, isStorm: false, isFog: false, isSnow: false },
  63: { descriptionVi: 'Mưa vừa', descriptionEn: 'Moderate rain', isRain: true, isStorm: false, isFog: false, isSnow: false },
  65: { descriptionVi: 'Mưa to', descriptionEn: 'Heavy rain', isRain: true, isStorm: false, isFog: false, isSnow: false },
  66: { descriptionVi: 'Mưa lạnh buốt', descriptionEn: 'Light freezing rain', isRain: true, isStorm: false, isFog: false, isSnow: false },
  67: { descriptionVi: 'Mưa lớn băng giá', descriptionEn: 'Heavy freezing rain', isRain: true, isStorm: false, isFog: false, isSnow: false },
  71: { descriptionVi: 'Tuyết rơi nhẹ', descriptionEn: 'Slight snow fall', isRain: false, isStorm: false, isFog: false, isSnow: true },
  73: { descriptionVi: 'Tuyết rơi vừa', descriptionEn: 'Moderate snow fall', isRain: false, isStorm: false, isFog: false, isSnow: true },
  75: { descriptionVi: 'Tuyết rơi dày', descriptionEn: 'Heavy snow fall', isRain: false, isStorm: false, isFog: false, isSnow: true },
  77: { descriptionVi: 'Tuyết hạt', descriptionEn: 'Snow grains', isRain: false, isStorm: false, isFog: false, isSnow: true },
  80: { descriptionVi: 'Mưa rào nhẹ', descriptionEn: 'Slight rain showers', isRain: true, isStorm: false, isFog: false, isSnow: false },
  81: { descriptionVi: 'Mưa rào vừa', descriptionEn: 'Moderate rain showers', isRain: true, isStorm: false, isFog: false, isSnow: false },
  82: { descriptionVi: 'Mưa rào dữ dội', descriptionEn: 'Violent rain showers', isRain: true, isStorm: true, isFog: false, isSnow: false },
  85: { descriptionVi: 'Mưa tuyết nhẹ', descriptionEn: 'Slight snow showers', isRain: false, isStorm: false, isFog: false, isSnow: true },
  86: { descriptionVi: 'Mưa tuyết dày', descriptionEn: 'Heavy snow showers', isRain: false, isStorm: false, isFog: false, isSnow: true },
  95: { descriptionVi: 'Dông bão', descriptionEn: 'Thunderstorm', isRain: true, isStorm: true, isFog: false, isSnow: false },
  96: { descriptionVi: 'Dông bão kèm mưa đá nhẹ', descriptionEn: 'Thunderstorm with slight hail', isRain: true, isStorm: true, isFog: false, isSnow: false },
  99: { descriptionVi: 'Dông bão kèm mưa đá dữ dội', descriptionEn: 'Thunderstorm with heavy hail', isRain: true, isStorm: true, isFog: false, isSnow: false },
}

export function mapWmoCode(code: number | null | undefined): WmoWeatherDescription {
  if (code == null) {
    return {
      code: -1,
      descriptionVi: 'Không có thông tin thời tiết',
      descriptionEn: 'Unknown weather',
      isRain: false,
      isStorm: false,
      isFog: false,
      isSnow: false,
    }
  }

  const found = WMO_CODE_TABLE[code]
  if (found) {
    return { code, ...found }
  }

  return {
    code,
    descriptionVi: `Thời tiết mã ${code}`,
    descriptionEn: `Weather code ${code}`,
    isRain: code >= 51 && code <= 67,
    isStorm: code >= 95,
    isFog: code === 45 || code === 48,
    isSnow: (code >= 71 && code <= 77) || code === 85 || code === 86,
  }
}
