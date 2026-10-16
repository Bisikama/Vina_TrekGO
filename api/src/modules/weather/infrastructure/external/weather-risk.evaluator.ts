import { WeatherRiskLevel } from '@prisma/client'
import { mapWmoCode } from './weather-wmo.mapper'

export interface RiskEvaluationInput {
  weatherCode?: number | null
  windSpeedMps?: number | null
  windGustMps?: number | null
  precipitationMm?: number | null
  rainProbabilityPercent?: number | null
  temperatureC?: number | null
}

export interface RiskEvaluationResult {
  riskLevel: WeatherRiskLevel
  riskSummary: string
}

export function evaluateWeatherRisk(input: RiskEvaluationInput): RiskEvaluationResult {
  const { weatherCode, windSpeedMps, windGustMps, precipitationMm, rainProbabilityPercent, temperatureC } = input
  const wmo = mapWmoCode(weatherCode)

  const warnings: string[] = []
  let level: WeatherRiskLevel = WeatherRiskLevel.LOW

  // 1. Kiểm tra dông bão / hiện tượng cực đoan (SEVERE)
  if (wmo.isStorm) {
    level = WeatherRiskLevel.SEVERE
    warnings.push(`Cảnh báo ${wmo.descriptionVi.toLowerCase()}`)
  }

  // 2. Kiểm tra gió & gió giật
  const gust = windGustMps ?? 0
  const wind = windSpeedMps ?? 0
  if (gust >= 20 || wind >= 15) {
    level = WeatherRiskLevel.SEVERE
    warnings.push('Gió giật rất mạnh nguy hiểm (trên 20 m/s)')
  } else if (gust >= 14 || wind >= 10) {
    if (level !== WeatherRiskLevel.SEVERE) level = WeatherRiskLevel.HIGH
    warnings.push('Gió mạnh trên các đỉnh/sống lưng núi')
  } else if (gust >= 9 || wind >= 7) {
    if (level === WeatherRiskLevel.LOW) level = WeatherRiskLevel.MEDIUM
    warnings.push('Gió vừa')
  }

  // 3. Kiểm tra lượng mưa & xác suất mưa
  const rainMm = precipitationMm ?? 0
  const rainProb = rainProbabilityPercent ?? 0
  if (rainMm >= 40) {
    level = WeatherRiskLevel.SEVERE
    warnings.push(`Mưa rất to (${rainMm}mm), nguy cơ lũ quét và sạt lở cao`)
  } else if (rainMm >= 15) {
    if (level !== WeatherRiskLevel.SEVERE) level = WeatherRiskLevel.HIGH
    warnings.push(`Mưa to (${rainMm}mm), đường trơn trượt nguy hiểm`)
  } else if (rainMm >= 3 || rainProb >= 60 || wmo.isRain) {
    if (level === WeatherRiskLevel.LOW) level = WeatherRiskLevel.MEDIUM
    warnings.push(`Có khả năng mưa (${wmo.descriptionVi.toLowerCase()}), cần chuẩn bị áo mưa`)
  }

  // 4. Kiểm tra sương mù / nhiệt độ cực thấp
  if (wmo.isFog) {
    if (level === WeatherRiskLevel.LOW) level = WeatherRiskLevel.MEDIUM
    warnings.push('Sương mù giảm tầm nhìn')
  }
  if (temperatureC != null && temperatureC <= 2) {
    if (level === WeatherRiskLevel.LOW) level = WeatherRiskLevel.MEDIUM
    warnings.push(`Nhiệt độ rất thấp (${temperatureC}°C), nguy cơ hạ thân nhiệt`)
  }

  // Tạo tóm tắt rủi ro
  let summary = ''
  if (warnings.length > 0) {
    summary = warnings.join('. ') + '.'
  } else {
    summary = `Thời tiết thuận lợi cho trekking (${wmo.descriptionVi.toLowerCase()}).`
  }

  return {
    riskLevel: level,
    riskSummary: summary,
  }
}
