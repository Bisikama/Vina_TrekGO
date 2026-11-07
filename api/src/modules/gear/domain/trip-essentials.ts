import type { TripContext } from './rule-predicates'

/**
 * Đồ thiết yếu không có thông số kỹ thuật (đèn đầu, nước, sơ cứu...): chỉ để đóng gói, không đánh giá món,
 * không đưa vào phương án thuê. Mã `ess_*` tách khỏi `req_*` của các yêu cầu có tiêu chí.
 */
export interface TripEssential {
  id: string
  title: string
  priority: 'REQUIRED' | 'RECOMMENDED'
  /** Lý do theo điều kiện chuyến, hiển thị cho người dùng. */
  reason: string
}

const hasTerrain = (trip: TripContext, ...tags: string[]) =>
  trip.terrain.some((tag) => tags.includes(tag.toLowerCase()))

export function buildTripEssentials(trip: TripContext): TripEssential[] {
  const overnight = trip.days >= 2
  const list: TripEssential[] = [
    {
      id: 'ess_water',
      title: 'Nước uống và bình/túi nước',
      priority: 'REQUIRED',
      reason:
        trip.temp_max_c >= 28
          ? `Trời nóng tới ${trip.temp_max_c}°C: mang ít nhất 2,5 lít mỗi ngày leo`
          : 'Mang ít nhất 1,5–2 lít mỗi ngày leo; điểm lấy nước trên cung có thể không chắc chắn',
    },
    {
      id: 'ess_first_aid',
      title: 'Túi sơ cứu và thuốc cá nhân',
      priority: 'REQUIRED',
      reason: 'Băng dán, băng cuộn, thuốc giảm đau, thuốc dị ứng và thuốc bạn đang dùng hằng ngày',
    },
    {
      id: 'ess_headlamp',
      title: 'Đèn đầu và pin dự phòng',
      priority: overnight || trip.difficulty >= 4 ? 'REQUIRED' : 'RECOMMENDED',
      reason: overnight
        ? 'Chuyến có ngủ đêm: cần đèn khi sinh hoạt tối và khi xuất phát sớm'
        : trip.difficulty >= 4
          ? `Cung khó (${trip.difficulty}/5) dễ về muộn hơn dự kiến`
          : 'Phòng khi về muộn hoặc đi qua đoạn rừng tối',
    },
    {
      id: 'ess_id_cash',
      title: 'Giấy tờ tuỳ thân và tiền mặt',
      priority: 'REQUIRED',
      reason: 'Thường cần khi qua trạm kiểm lâm và chi trả ở vùng không có sóng',
    },
    {
      id: 'ess_snack',
      title: 'Đồ ăn nhẹ năng lượng',
      priority: 'RECOMMENDED',
      reason: 'Thanh năng lượng, kẹo, hạt để bổ sung giữa các chặng',
    },
    {
      id: 'ess_power_bank',
      title: 'Sạc dự phòng',
      priority: overnight ? 'REQUIRED' : 'RECOMMENDED',
      reason: 'Điện thoại cần cho bản đồ, định vị và liên lạc khẩn cấp',
    },
  ]

  if (overnight) {
    list.push({
      id: 'ess_spare_clothes',
      title: 'Quần áo và tất thay',
      priority: 'REQUIRED',
      reason: `Chuyến ${trip.days} ngày: giữ một bộ khô để thay buổi tối`,
    })
  }

  if (trip.temp_min_night_c <= 12) {
    list.push({
      id: 'ess_warm_layer',
      title: 'Áo lớp giữa giữ nhiệt (fleece hoặc lông vũ mỏng)',
      priority: 'REQUIRED',
      reason: `Ban đêm xuống ${trip.temp_min_night_c}°C: mặc thêm bên trong áo khoác khi dừng nghỉ`,
    })
  }

  if (trip.temp_min_night_c <= 8) {
    list.push({
      id: 'ess_hat_gloves',
      title: 'Mũ len và găng tay',
      priority: trip.temp_min_night_c <= 3 ? 'REQUIRED' : 'RECOMMENDED',
      reason: `Nhiệt độ thấp nhất ${trip.temp_min_night_c}°C, gió trên đỉnh làm cảm giác lạnh hơn`,
    })
  }

  if (trip.temp_max_c >= 28) {
    list.push({
      id: 'ess_sun',
      title: 'Kem chống nắng, kính râm, mũ rộng vành',
      priority: 'RECOMMENDED',
      reason: `Ban ngày lên tới ${trip.temp_max_c}°C`,
    })
  }

  if (trip.rain_prob_pct >= 50) {
    list.push({
      id: 'ess_dry_bag',
      title: 'Túi chống nước cho điện thoại và quần áo',
      priority: 'REQUIRED',
      reason: `Khả năng mưa ${trip.rain_prob_pct}%: áo trùm balo không giữ khô được hoàn toàn`,
    })
  }

  if (trip.rain_prob_pct >= 50 && hasTerrain(trip, 'forest', 'muddy', 'stream', 'river')) {
    list.push({
      id: 'ess_leech_socks',
      title: 'Tất chống vắt',
      priority: 'RECOMMENDED',
      reason: 'Rừng ẩm, đường bùn mùa mưa thường có vắt',
    })
  }

  return list
}
