import { DamageDeductionType, DamageSeverity, Prisma, PrismaClient, RentalProductStatus } from '@prisma/client'
import { RENTAL_PRODUCT_SEEDS } from './rental-product.seed'

export interface DamageRuleTemplate {
  ruleCode: string
  name: string
  description: string
  severity: DamageSeverity
  deductionType: DamageDeductionType
  deductionValue: number
  requiresApproval: boolean
}

export interface SeededDamageRuleRecord extends DamageRuleTemplate {
  id: string
  productId: string
  versionNo: number
  effectiveFrom: Date
  effectiveTo: Date | null
  isActive: boolean
}

/**
 * Standard damage assessment rule templates grouped by usageGroup.
 * Formulations strictly adhere to Policy v1.5.2:
 * - Ordinary wear & tear = 0% (no penalty rule)
 * - Pre-existing damage = 0% (inspected against handover condition snapshot)
 * - Missing accessory = fixed replacement cost (FIXED formula)
 * - Repairable damage = actual repair cost up to deposit (FIXED or PERCENT_DEPOSIT <= 100%)
 * - Lost / Irreparable = up to 100% deposit (PERCENT_DEPOSIT 100%)
 */
export const USAGE_GROUP_DAMAGE_RULES: Record<string, DamageRuleTemplate[]> = {
  SHELTER: [
    {
      ruleCode: 'SHELTER_DIRT_STAIN',
      name: 'Vết bẩn bùn đất trên bạt lều / tăng dã ngoại',
      description: 'Bạt lều hoặc tấm tăng bị bám bùn đất thông thường cần dịch vụ giặt sấy chuyên dụng.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 50_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'SHELTER_POLE_BENT',
      name: 'Cong hoặc rạn nứt thanh khung lều / cọc tăng',
      description: 'Khung lều hợp kim nhôm bị uốn cong hoặc nứt khớp nối cần uốn nắn hoặc thay thế một đốt.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 150_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'SHELTER_FABRIC_BURN',
      name: 'Rách lớn / thủng do tàn lửa than trên vải lều',
      description: 'Lớp bạt lều bị cháy thủng lỗ hoặc rách trên 10cm làm mất khả năng chống nước hoàn toàn.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 40,
      requiresApproval: true,
    },
    {
      ruleCode: 'SHELTER_TOTAL_LOSS',
      name: 'Hỏng toàn bộ kết cấu / Mất lều không thể phục hồi',
      description:
        'Lều bị gãy nát toàn bộ khung, rách toang hoặc mất tích không thể hoàn trả vào kho (khấu trừ tối đa 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  CARRY: [
    {
      ruleCode: 'CARRY_STRAP_TORN',
      name: 'Đứt chỉ quai phụ / sờn rách dây đai balo nhẹ',
      description: 'Dây đai ngực hoặc quai phụ bị bung chỉ nhẹ có thể may gia cố phục hồi tại chỗ.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 40_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'CARRY_ZIPPER_BROKEN',
      name: 'Hỏng hoặc kẹt khóa kéo chính ngăn balo',
      description: 'Dây kéo chính bị gãy răng cưa hoặc bung củ khóa cần thay cụm khóa mới.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 80_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'CARRY_FRAME_BENT',
      name: 'Gãy khung nhôm trợ lực / rách toang thân balo',
      description: 'Khung trợ lực lưng bị biến dạng gãy nứt hoặc thân vải Cordura bị rách sâu khó phục hồi.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 50,
      requiresApproval: true,
    },
    {
      ruleCode: 'CARRY_TOTAL_LOSS',
      name: 'Hỏng toàn bộ hoặc mất balo không thể phục hồi',
      description: 'Balo bị xé rách nát hoàn toàn hoặc khách báo làm rơi mất trong chuyến đi (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  SLEEP: [
    {
      ruleCode: 'SLEEP_STAIN_DIRT',
      name: 'Dính bẩn hoặc ám mùi cần giặt sấy chuyên dụng',
      description: 'Túi ngủ hoặc đệm cách nhiệt bị dính bẩn bùn đất cần chu trình giặt sấy diệt khuẩn chuyên sâu.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 30_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'SLEEP_PUNCTURE',
      name: 'Thủng lỗ đệm hơi hoặc rách lớp lót túi ngủ',
      description: 'Đệm hơi bị xì lỗ mọt hoặc túi ngủ rách lớp lót trong cần dán vá nhiệt chuyên dụng.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 70_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'SLEEP_MOLD_DAMAGE',
      name: 'Ẩm mốc nặng / hỏng hoàn toàn lớp bông cách nhiệt',
      description: 'Túi ngủ bị ngâm nước mưa lâu ngày phát sinh mốc đen hoặc vón cục bông không thể giữ nhiệt.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 50,
      requiresApproval: true,
    },
    {
      ruleCode: 'SLEEP_TOTAL_LOSS',
      name: 'Mất hoặc hỏng rách toàn bộ đệm / túi ngủ',
      description: 'Túi ngủ hoặc đệm hơi bị rách toang toàn diện hoặc thất lạc không thể thu hồi (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  FOOTWEAR: [
    {
      ruleCode: 'FOOTWEAR_LACE_TORN',
      name: 'Đứt dây giày hoặc trầy xước nhẹ mũi giày',
      description: 'Dây giày trekking bị sờn đứt hoặc phần cao su bảo vệ ngón chân bị trầy xước nông.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 20_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'FOOTWEAR_SOLE_DETACHED',
      name: 'Bong mép keo đế giày cần ép nhiệt lại',
      description: 'Đế giày bám địa hình bị hở mép keo từ 2-5cm cần xử lý dán keo chuyên dụng và ép thủy lực.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 100_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'FOOTWEAR_UPPER_TORN',
      name: 'Rách toác vải thân giày hoặc gãy đế chống trượt',
      description: 'Thân giày bị gai nhọn rách thủng xuyên thấu hoặc gãy nứt lõi đế hỗ trợ vòm bàn chân.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 50,
      requiresApproval: true,
    },
    {
      ruleCode: 'FOOTWEAR_TOTAL_LOSS',
      name: 'Mất hoặc biến dạng nát giày không thể tái sử dụng',
      description:
        'Giày bị nước lũ cuốn trôi mất hoặc rách nát biến dạng không an toàn cho người thuê sau (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  MOBILITY: [
    {
      ruleCode: 'MOBILITY_TIP_WORN',
      name: 'Mất hoặc mòn rách đầu bọc cao su chống trượt',
      description: 'Đầu bọc cao su gậy trekking bị rơi mất hoặc mòn trơ đầu kim loại vonfram.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 20_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'MOBILITY_LOCK_LOOSE',
      name: 'Hỏng chốt khóa điều chỉnh độ dài đoạn gậy',
      description: 'Khóa gạt nhanh (flip-lock) hoặc khớp vặn xoay bị trờn ren không thể cố định chiều cao gậy.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 50_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'MOBILITY_POLE_BENT',
      name: 'Cong vẹo hoặc gãy một đốt thân gậy trekking',
      description: 'Thân gậy hợp kim duralumin bị bẻ cong góc trên 20 độ hoặc nứt gãy một đốt lồng.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 100_000,
      requiresApproval: true,
    },
    {
      ruleCode: 'MOBILITY_TOTAL_LOSS',
      name: 'Gãy nát nhiều đoạn hoặc mất gậy trekking',
      description: 'Gậy trekking bị gãy gập nhiều khúc không thể thay thế hoặc bị thất lạc (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  WEATHER_PROTECTION: [
    {
      ruleCode: 'WEATHER_DIRT_HEAVY',
      name: 'Dính bùn đất nặng cần tẩy rửa nhẹ chuyên dụng',
      description: 'Áo mưa bộ dính nhiều bùn đất đỏ bám chặt cần ngâm tẩy với dung dịch bảo vệ lớp màng DWR.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 20_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'WEATHER_SEAM_TEAR',
      name: 'Bung đường ép nhiệt chống thấm (seam-tape)',
      description: 'Đường băng dán chống nước đường may ở vai hoặc nách bị bong tróc cần dán nhiệt lại.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 50_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'WEATHER_FABRIC_TORN',
      name: 'Rách toang màng chống thấm / thân áo mưa',
      description: 'Thân áo quần mưa bị rách dài trên 5cm làm mất hoàn toàn tính năng che mưa gió.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 40,
      requiresApproval: true,
    },
    {
      ruleCode: 'WEATHER_TOTAL_LOSS',
      name: 'Rách nát hoàn toàn hoặc mất trang phục đi mưa',
      description:
        'Trang phục chống nước bị rách vụn không thể sửa chữa hoặc bị bỏ quên mất trên đường đi (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  LIGHTING: [
    {
      ruleCode: 'LIGHT_SCRATCH',
      name: 'Trầy xước nhẹ thân đèn hoặc chóa phản quang',
      description: 'Vỏ đèn đeo đầu hoặc mặt kính mica có vết xước dăm nhưng không ảnh hưởng khả năng chiếu sáng.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 20_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'LIGHT_SWITCH_FAIL',
      name: 'Liệt công tắc bấm hoặc đứt quai đeo co giãn',
      description: 'Nút bấm silicon bị kẹt lún hoặc dây thun đeo đầu bị giãn đứt cần thay thế phụ kiện.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 60_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'LIGHT_WATER_IN',
      name: 'Vào nước chập cháy bóng LED hoặc bo mạch nguồn',
      description: 'Nước mưa ngấm vào khoang pin gây oxy hóa chân tiếp xúc hoặc cháy diode phát quang.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 120_000,
      requiresApproval: true,
    },
    {
      ruleCode: 'LIGHT_TOTAL_LOSS',
      name: 'Vỡ nát hoàn toàn hoặc mất đèn pin / đèn lều',
      description:
        'Thiết bị chiếu sáng bị rơi đập vỡ vụn hoặc rơi mất trên vách núi không thể thu hồi (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  POWER: [
    {
      ruleCode: 'POWER_PORT_LOOSE',
      name: 'Lỏng chân cắm sạc hoặc trầy xước vỏ bảo vệ',
      description: 'Cổng cắm USB-A/Type-C có dấu hiệu lỏng nhẹ hoặc lớp vỏ ngoài bị trầy móp.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 30_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'POWER_CABLE_LOST',
      name: 'Mất cáp sạc nhanh đi kèm theo pin dự phòng',
      description:
        'Dây cáp sạc tiêu chuẩn cấp kèm theo sạc dự phòng không được hoàn trả đầy đủ (theo giá thay thế phụ kiện).',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 50_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'POWER_CELL_DEGRADED',
      name: 'Phồng cell pin hoặc chập mạch nguồn ngắt tự động',
      description: 'Khối pin lithium bên trong có dấu hiệu căng phồng biến dạng gây nguy cơ cháy nổ.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 50,
      requiresApproval: true,
    },
    {
      ruleCode: 'POWER_TOTAL_LOSS',
      name: 'Mất sạc dự phòng hoặc chập nổ hỏng toàn bộ',
      description: 'Khách hàng làm rơi mất pin sạc hoặc thiết bị chập điện cháy bo mạch hoàn toàn (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  COOKING: [
    {
      ruleCode: 'COOKING_CHARRED',
      name: 'Cháy khét muội than cần ngâm cọ rửa chuyên dụng',
      description: 'Đáy nồi dã ngoại hoặc kiềng bếp gas mini bám cặn khét cứng cần ngâm hóa chất cọ rửa.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 30_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'COOKING_VALVE_STUCK',
      name: 'Kẹt van điều áp hoặc móp méo nắp / quai nồi',
      description: 'Núm vặn gas bị cong kẹt hoặc quai nồi nhôm anodized bị móp méo không khớp khít.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 60_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'COOKING_IGNITER_BROKEN',
      name: 'Hỏng bộ phận đánh lửa gốm piezo / nứt thân bếp',
      description: 'Kim đánh lửa điện áp piezo bị gãy hoặc ống dẫn gas bị xì nứt nguy hiểm.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 100_000,
      requiresApproval: true,
    },
    {
      ruleCode: 'COOKING_TOTAL_LOSS',
      name: 'Mất bếp / bộ nồi hoặc biến dạng nát không dùng được',
      description: 'Bộ nồi bị xe đè bẹp dúm hoặc rơi mất bếp nấu ăn trên đường di chuyển trekking (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  WATER_TREATMENT: [
    {
      ruleCode: 'WATER_FILTER_DIRTY',
      name: 'Cặn bẩn bám màng lọc cần sục rửa hóa chất bảo dưỡng',
      description: 'Màng lọc nước dã ngoại bị tắc nghẽn bùn hữu cơ cần quy trình sục ngược bằng bơm chuyên dụng.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 30_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'WATER_HOSE_PUNCTURE',
      name: 'Thủng dây dẫn nước hoặc hỏng bóng bóp bơm tay',
      description: 'Ống dẫn nước silicon bị thủng hoặc bóng bóp tạo áp lực bị rách van 1 chiều.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 60_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'WATER_CORE_CRACKED',
      name: 'Nứt vỡ lõi lọc sợi rỗng / màng lọc gốm siêu vi',
      description: 'Lõi lọc bên trong bị rơi đập vỡ làm rò rỉ vi khuẩn không còn đạt tiêu chuẩn an toàn sinh học.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 50,
      requiresApproval: true,
    },
    {
      ruleCode: 'WATER_TOTAL_LOSS',
      name: 'Vỡ nát hoàn toàn hoặc mất bộ lọc nước dã ngoại',
      description: 'Thiết bị lọc nước bị rơi mất hoặc vỡ nát thân vỏ nhựa chịu lực (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  NAVIGATION: [
    {
      ruleCode: 'NAV_SCRATCH_CASING',
      name: 'Trầy xước vỏ bảo vệ hoặc bong bọc cao su GPS / la bàn',
      description: 'Vỏ nhựa hoặc viền silicon chống sốc có vết trầy xước va chạm với đất đá.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 30_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'NAV_BUTTON_STICKY',
      name: 'Kẹt phím điều hướng hoặc bong ron chống nước IPX7',
      description: 'Phím joystick/nút nguồn bị sượng hoặc gioăng cao su nắp pin bị hở mất chuẩn kháng nước.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 100_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'NAV_SCREEN_CRACKED',
      name: 'Nứt vỡ màn hình hiển thị GPS hoặc la bàn rò dầu',
      description: 'Màn hình màu LCD định vị bị rạn nứt do va đập đá hoặc mặt kính la bàn chảy dầu giảm chấn.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 50,
      requiresApproval: true,
    },
    {
      ruleCode: 'NAV_TOTAL_LOSS',
      name: 'Rơi mất thiết bị GPS / la bàn hoặc vỡ nát hoàn toàn',
      description:
        'Thiết bị GPS cầm tay bị rơi mất trong rừng hoặc ngấm nước biển chập cháy bo mạch chủ (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
  SURVIVAL: [
    {
      ruleCode: 'SURVIVAL_BLADE_DULL',
      name: 'Mẻ lưỡi dao nhẹ cần mài tạo lưỡi và khử sét',
      description: 'Lưỡi dao thép không gỉ bị mẻ răm nhỏ dưới 1mm cần mài góc vát và tra dầu bảo quản.',
      severity: DamageSeverity.MINOR,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 20_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'SURVIVAL_TOOL_BENT',
      name: 'Cong méo đầu kìm / dao cưa / dụng cụ khui hộp',
      description: 'Một phụ kiện chức năng trên kìm đa năng bị uốn cong hoặc lệch trục cơ khí.',
      severity: DamageSeverity.MODERATE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 50_000,
      requiresApproval: false,
    },
    {
      ruleCode: 'SURVIVAL_SPRING_BROKEN',
      name: 'Gãy lò xo trợ lực hoặc hỏng chốt khóa an toàn đa năng',
      description: 'Khóa hãm lưỡi (liner-lock) bị trờn không khóa an toàn được lưỡi dao gây nguy hiểm thao tác.',
      severity: DamageSeverity.SEVERE,
      deductionType: DamageDeductionType.FIXED,
      deductionValue: 100_000,
      requiresApproval: true,
    },
    {
      ruleCode: 'SURVIVAL_TOTAL_LOSS',
      name: 'Mất dao đa năng sinh tồn hoặc gãy gập khung chính',
      description:
        'Dao đa năng bỏ túi bị rơi mất trong chuyến dã ngoại hoặc gãy đứt gọng khung chính (khấu trừ 100% cọc).',
      severity: DamageSeverity.TOTAL_LOSS,
      deductionType: DamageDeductionType.PERCENT_DEPOSIT,
      deductionValue: 100,
      requiresApproval: true,
    },
  ],
}

/**
 * Generates an RFC4122-compliant 36-char deterministic UUID for a given product sequence and rule index.
 * Format: dddddd11-PPPP-0001-0001-RRRRRRRRRRRR
 */
export function buildDeterministicRuleId(productIndex: number, ruleIndex: number): string {
  const prodSeq = productIndex.toString().padStart(4, '0')
  const ruleSeq = ruleIndex.toString().padStart(12, '0')
  return `dddddd11-${prodSeq}-0001-0001-${ruleSeq}`
}

/**
 * Deterministic UUIDs for primary test products for instant copy-pasting during manual Swagger testing:
 */
export const PRIMARY_TENT_DAMAGE_RULES = {
  DIRT_STAIN: 'dddddd11-0001-0001-0001-000000000001',
  POLE_BENT: 'dddddd11-0001-0001-0001-000000000002',
  FABRIC_BURN: 'dddddd11-0001-0001-0001-000000000003',
  TOTAL_LOSS: 'dddddd11-0001-0001-0001-000000000004',
} as const

export const PRIMARY_GPS_DAMAGE_RULES = {
  SCRATCH_CASING: 'dddddd11-0028-0001-0001-000000000001',
  BUTTON_STICKY: 'dddddd11-0028-0001-0001-000000000002',
  SCREEN_CRACKED: 'dddddd11-0028-0001-0001-000000000003',
  TOTAL_LOSS: 'dddddd11-0028-0001-0001-000000000004',
} as const

export function buildDamageAssessmentRuleSeedData(
  products: ReadonlyArray<{ id: string; sku: string; usageGroup: string | null }>,
  effectiveFrom = new Date('2024-01-01T00:00:00.000Z'),
): SeededDamageRuleRecord[] {
  const result: SeededDamageRuleRecord[] = []

  products.forEach((product, pIndex) => {
    const productSeq = pIndex + 1
    const templates = USAGE_GROUP_DAMAGE_RULES[product.usageGroup ?? 'SHELTER'] ?? USAGE_GROUP_DAMAGE_RULES.SHELTER

    templates.forEach((tpl, rIndex) => {
      const ruleSeq = rIndex + 1
      result.push({
        id: buildDeterministicRuleId(productSeq, ruleSeq),
        productId: product.id,
        ruleCode: tpl.ruleCode,
        name: tpl.name,
        description: tpl.description,
        severity: tpl.severity,
        deductionType: tpl.deductionType,
        deductionValue: tpl.deductionValue,
        requiresApproval: tpl.requiresApproval,
        versionNo: 1,
        effectiveFrom,
        effectiveTo: null,
        isActive: true,
      })
    })
  })

  return result
}

export async function seedDamageAssessmentRules(prisma: PrismaClient) {
  console.log('Seeding Damage Assessment Rules...')

  // Step 1: Query all ACTIVE products present in the database to guarantee 100% product coverage
  const dbProducts = await prisma.rentalProduct.findMany({
    where: { status: RentalProductStatus.ACTIVE },
    select: { id: true, sku: true, usageGroup: true },
    orderBy: { sku: 'asc' },
  })

  // Ensure deterministic ordering by matching against RENTAL_PRODUCT_SEEDS first, then any extra DB products
  const seedSkuOrder = new Map(RENTAL_PRODUCT_SEEDS.map((p, idx) => [p.sku, idx]))
  const orderedProducts = [...dbProducts].sort((a, b) => {
    const orderA = seedSkuOrder.has(a.sku) ? seedSkuOrder.get(a.sku)! : 9999
    const orderB = seedSkuOrder.has(b.sku) ? seedSkuOrder.get(b.sku)! : 9999
    return orderA - orderB || a.sku.localeCompare(b.sku)
  })

  if (orderedProducts.length === 0) {
    throw new Error('Missing ACTIVE rental products for damage assessment rules seed')
  }

  const seedRecords = buildDamageAssessmentRuleSeedData(orderedProducts)

  let createdCount = 0
  let updatedCount = 0

  for (const record of seedRecords) {
    const existing = await prisma.damageAssessmentRule.findUnique({
      where: {
        productId_ruleCode_versionNo: {
          productId: record.productId,
          ruleCode: record.ruleCode,
          versionNo: record.versionNo,
        },
      },
      select: { id: true },
    })

    await prisma.damageAssessmentRule.upsert({
      where: {
        productId_ruleCode_versionNo: {
          productId: record.productId,
          ruleCode: record.ruleCode,
          versionNo: record.versionNo,
        },
      },
      update: {
        name: record.name,
        description: record.description,
        severity: record.severity,
        deductionType: record.deductionType,
        deductionValue: new Prisma.Decimal(record.deductionValue),
        requiresApproval: record.requiresApproval,
        effectiveFrom: record.effectiveFrom,
        effectiveTo: record.effectiveTo,
        isActive: record.isActive,
      },
      create: {
        id: record.id,
        productId: record.productId,
        ruleCode: record.ruleCode,
        name: record.name,
        description: record.description,
        severity: record.severity,
        deductionType: record.deductionType,
        deductionValue: new Prisma.Decimal(record.deductionValue),
        requiresApproval: record.requiresApproval,
        versionNo: record.versionNo,
        effectiveFrom: record.effectiveFrom,
        effectiveTo: record.effectiveTo,
        isActive: record.isActive,
      },
    })

    if (existing) {
      updatedCount++
    } else {
      createdCount++
    }
  }

  console.log(
    `Seeded ${seedRecords.length} damage assessment rules across ${orderedProducts.length} rental products (Created: ${createdCount}, Updated: ${updatedCount}).`,
  )
}

if (require.main === module) {
  const prisma = new PrismaClient()
  seedDamageAssessmentRules(prisma)
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
