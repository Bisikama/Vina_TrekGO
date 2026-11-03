export type FieldRole = 'STAFF_DELIVERY' | 'LEADER';

export const fieldAccounts = {
  STAFF_DELIVERY: { name: 'Hoàng Văn Tuấn', email: 'delivery.mock@trekgo.vn', label: 'Staff Delivery' },
  LEADER: { name: 'Minh Khoa', email: 'leader.mock@trekgo.vn', label: 'Mountain Leader', canCreatePublicTrip: true },
} as const;

export const deliveryTasks = [
  { id: 'DEL-2048', type: 'GIAO_THIET_BI', title: 'Bàn giao thiết bị trekking', customer: 'Nguyễn Tuấn Anh', location: 'Trạm Tả Van, Sa Pa', time: '08:30 hôm nay', status: 'Đang chờ xác minh', items: 'Balo 45L · Gậy trekking · Bộ áo mưa' },
  { id: 'RET-1182', type: 'THU_HOI', title: 'Thu hồi thiết bị sau chuyến', customer: 'Lê Mai Phương', location: 'Bản Sín Chải, Sa Pa', time: '16:00 hôm nay', status: 'Đã phân công', items: 'Balo 45L · Đèn đội đầu' },
] as const;

export const leaderTrip = {
  name: 'Tà Năng - Phan Dũng',
  code: 'TRIP-TA-0926',
  date: '02 - 04.10.2026',
  status: 'Đang chuẩn bị',
  members: 6,
  checkedIn: 4,
  nextCheckpoint: 'CP03 - Đồi Lính',
  altitude: '1,420m',
};

export const leaderMembers = [
  { name: 'Minh Khoa', role: 'Leader', status: 'Đã check-in' },
  { name: 'Nguyễn Văn A', role: 'Member', status: 'Đã check-in' },
  { name: 'Trần Ngọc B', role: 'Member', status: 'Chờ check-in' },
  { name: 'Lê Mai Phương', role: 'Member', status: 'Đã check-in' },
];