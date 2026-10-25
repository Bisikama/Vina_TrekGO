/**
 * Canonical Climate Estimation Registry
 * SOT for seasonal and geographical climate estimates in Vietnam trekking destinations.
 * Used exclusively for initial prefill suggestions (labeled CLIMATE_ESTIMATE).
 * Clients/users must review and confirm (or override) these values before evaluation.
 */

export interface ClimateEstimateData {
  destination: string;
  month: number; // 1..12
  temp_min_c: number;
  temp_max_c: number;
  temp_min_night_c: number;
  rain_prob_pct: number;
  source: 'CLIMATE_ESTIMATE';
  sourceReference: string;
}

export const CLIMATE_ESTIMATE_REGISTRY: Record<string, Record<number, Omit<ClimateEstimateData, 'destination' | 'month' | 'source'>>> = {
  // Bidoup - Nui Ba National Park (Lam Dong)
  bidoup: {
    1: { temp_min_c: 10, temp_max_c: 22, temp_min_night_c: 8, rain_prob_pct: 15, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    2: { temp_min_c: 11, temp_max_c: 24, temp_min_night_c: 9, rain_prob_pct: 10, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    3: { temp_min_c: 13, temp_max_c: 26, temp_min_night_c: 11, rain_prob_pct: 25, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    4: { temp_min_c: 15, temp_max_c: 27, temp_min_night_c: 13, rain_prob_pct: 45, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    5: { temp_min_c: 16, temp_max_c: 26, temp_min_night_c: 14, rain_prob_pct: 65, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    6: { temp_min_c: 16, temp_max_c: 25, temp_min_night_c: 14, rain_prob_pct: 75, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    7: { temp_min_c: 16, temp_max_c: 24, temp_min_night_c: 14, rain_prob_pct: 80, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    8: { temp_min_c: 16, temp_max_c: 24, temp_min_night_c: 14, rain_prob_pct: 80, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    9: { temp_min_c: 15, temp_max_c: 24, temp_min_night_c: 13, rain_prob_pct: 85, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    10: { temp_min_c: 14, temp_max_c: 23, temp_min_night_c: 12, rain_prob_pct: 75, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    11: { temp_min_c: 12, temp_max_c: 22, temp_min_night_c: 10, rain_prob_pct: 45, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
    12: { temp_min_c: 10, temp_max_c: 21, temp_min_night_c: 7, rain_prob_pct: 25, sourceReference: 'VN-Meteo-LamDong-Historical-2024' },
  },
  // Fansipan - Hoang Lien Son (Lao Cai)
  fansipan: {
    1: { temp_min_c: 2, temp_max_c: 10, temp_min_night_c: 0, rain_prob_pct: 20, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    2: { temp_min_c: 3, temp_max_c: 12, temp_min_night_c: 1, rain_prob_pct: 25, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    3: { temp_min_c: 7, temp_max_c: 16, temp_min_night_c: 5, rain_prob_pct: 35, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    4: { temp_min_c: 11, temp_max_c: 20, temp_min_night_c: 9, rain_prob_pct: 50, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    5: { temp_min_c: 14, temp_max_c: 22, temp_min_night_c: 12, rain_prob_pct: 65, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    6: { temp_min_c: 15, temp_max_c: 22, temp_min_night_c: 13, rain_prob_pct: 80, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    7: { temp_min_c: 15, temp_max_c: 22, temp_min_night_c: 13, rain_prob_pct: 85, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    8: { temp_min_c: 15, temp_max_c: 21, temp_min_night_c: 13, rain_prob_pct: 85, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    9: { temp_min_c: 13, temp_max_c: 20, temp_min_night_c: 11, rain_prob_pct: 70, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    10: { temp_min_c: 10, temp_max_c: 17, temp_min_night_c: 8, rain_prob_pct: 50, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    11: { temp_min_c: 6, temp_max_c: 14, temp_min_night_c: 4, rain_prob_pct: 30, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
    12: { temp_min_c: 3, temp_max_c: 11, temp_min_night_c: 1, rain_prob_pct: 20, sourceReference: 'VN-Meteo-LaoCai-Historical-2024' },
  },
  // Ta Nang - Phan Dung (Lam Dong / Binh Thuan)
  'ta nang': {
    1: { temp_min_c: 16, temp_max_c: 28, temp_min_night_c: 14, rain_prob_pct: 10, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    2: { temp_min_c: 17, temp_max_c: 30, temp_min_night_c: 15, rain_prob_pct: 10, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    3: { temp_min_c: 19, temp_max_c: 32, temp_min_night_c: 17, rain_prob_pct: 20, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    4: { temp_min_c: 21, temp_max_c: 33, temp_min_night_c: 19, rain_prob_pct: 35, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    5: { temp_min_c: 22, temp_max_c: 31, temp_min_night_c: 20, rain_prob_pct: 60, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    6: { temp_min_c: 22, temp_max_c: 30, temp_min_night_c: 20, rain_prob_pct: 70, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    7: { temp_min_c: 21, temp_max_c: 29, temp_min_night_c: 19, rain_prob_pct: 75, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    8: { temp_min_c: 21, temp_max_c: 29, temp_min_night_c: 19, rain_prob_pct: 75, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    9: { temp_min_c: 21, temp_max_c: 29, temp_min_night_c: 19, rain_prob_pct: 80, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    10: { temp_min_c: 20, temp_max_c: 29, temp_min_night_c: 18, rain_prob_pct: 65, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    11: { temp_min_c: 18, temp_max_c: 28, temp_min_night_c: 16, rain_prob_pct: 40, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
    12: { temp_min_c: 16, temp_max_c: 27, temp_min_night_c: 14, rain_prob_pct: 20, sourceReference: 'VN-Meteo-BinhThuan-Historical-2024' },
  },
};

export function lookupClimateEstimate(destination: string, month: number): ClimateEstimateData | null {
  if (!destination || typeof destination !== 'string') return null;
  if (!month || month < 1 || month > 12) return null;

  const normalized = destination.toLowerCase().trim();
  for (const [key, monthlyData] of Object.entries(CLIMATE_ESTIMATE_REGISTRY)) {
    if (normalized.includes(key)) {
      const data = monthlyData[month];
      if (data) {
        return {
          destination: key,
          month,
          ...data,
          source: 'CLIMATE_ESTIMATE',
        };
      }
    }
  }

  return null;
}

