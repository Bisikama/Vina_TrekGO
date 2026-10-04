export const DELIVERY_MOCK_DATA = {
  staff: {
    name: 'Hoàng Văn Tuấn',
    role: 'Nhân viên Giao nhận Thực địa • Hub Sa Pa',
    shift: 'Sáng: 06:00 - 14:00',
    location: 'Số 02 Cầu Mây, Sa Pa',
    status: 'TRỰC TUYẾN',
  },
  taskStats: {
    pending: 2,
    delivering: 3,
    returning: 4,
    completed: 5,
  },
  tasks: [
    {
      id: '#BK-7892',
      type: 'GIAO THIẾT BỊ',
      urgent: true,
      time: '06:00 - 06:20 (Còn 25p)',
      customerName: 'Nguyễn Tuấn Anh',
      phone: '0982***618',
      tour: 'Chinh phục Fansipan 3N2Đ (Đoàn 8 khách)',
      location: 'Sảnh Cổng Trạm Tôn',
      distance: 'Cách bạn 1.2 km',
      desc: 'Đèo Ô Quy Hồ, điểm kiểm lâm xuất phát',
      equipmentCount: 4,
      items: 'Gồm: 04 Gậy leo núi Carbon, 02 Đèn trán Petzl, ...',
    },
    {
      id: '#BK-8014',
      type: 'GIAO THIẾT BỊ',
      urgent: false,
      time: '07:15 - 07:30',
      customerName: 'Trần Mai Chi',
      tour: 'Trekking Lão Thẩn săn mây 2N1Đ',
      location: 'Sa Pa Hub HQ (Tại chỗ)',
      desc: 'Khách đến quầy kiểm tra và nhận túi đồ',
      equipmentCount: 2,
      status: 'Kho đang chuẩn bị thiết bị (Chờ xác nhận)',
    },
    {
      id: '#BK-7612',
      type: 'THU HỒI THIẾT BỊ',
      urgent: false,
      time: '14:30 Chiều',
      customerName: 'Lê Hoàng Nam',
      tour: 'Fansipan 3N2Đ (Hạ sơn về lối Sín Chải)',
      location: 'Điểm đón xe bản Sín Chải',
      desc: 'Bãi đỗ xe trung chuyển cuối chân núi',
      equipmentCount: 6,
    }
  ],
  taskDetail: {
    id: '#BK-7892',
    tour: 'Chinh phục Fansipan 3N2Đ',
    customer: 'Nguyễn Tuấn Anh',
    phone: '0982***618',
    receiveLocation: 'Trạm Tôn - VQG Hoàng Liên',
    distance: 'Cách Hub 1.8 km',
    timeFrame: '06:00 - 06:20 Sáng',
    travelTime: '~12 phút di chuyển',
    route: 'Tuyến đường dã chiến • ĐÈO Ô QUY HỒ',
    roadStatus: 'Sương mù nhẹ • Đường khô ráo',
    note: '"Khách đi cùng đoàn có trưởng đoàn Hoàng Văn Nam, tập kết tại quán cafe đối diện cổng trạm kiểm lâm."',
    deposit: '2.400.000 đ',
    equipments: [
      { id: '#EQ-BL-4508', name: 'Balo Deuter Aircontact 45L', qty: 1, desc: 'Kèm bọc mưa chống thấm dã ngoại', status: 'Mới 98%, đủ khóa cài nguyên bản' },
      { id: '#EQ-GT-8812', name: 'Cặp Gậy Carbon BD Trail Pro', qty: 2, desc: 'Tay nắm xốp EVA, dây đeo dệt', status: 'Khóa flicklock chắc, đủ đầu cao su' },
      { id: '#EQ-AM-1044', name: 'Áo mưa bộ Gore-Tex (Size L)', qty: 1, desc: 'Chống thấm 20,000mm, đường ép dán', status: 'Đã giặt sấy tiệt trùng, nguyên nén' },
      { id: '#EQ-DP-3301', name: 'Đèn pin đội đầu Naturehike 220...', qty: 1, desc: 'Tiêu chuẩn chống nước IPX4 dã ngoại', status: 'Pin sạc 100%, kèm cáp Type-C' }
    ]
  },
  qrVerify: {
    customer: 'Nguyễn Tuấn Anh',
    tour: 'Fansipan 3N2Đ',
    id: '#BK-7892',
    location: 'Cổng Trạm Tôn',
    otp: '852019',
    verifiedTime: '05:45 AM'
  },
  checklist: {
    id: '#BK-7892',
    customer: 'Nguyễn Tuấn Anh',
    progress: '75%',
    items: [
      { id: 1, name: 'Balo trekking 45L Deuter Aircontact', checked: true, note: 'Khách đã kiểm tra quai đeo & khóa kéo', scanTime: '14:02' },
      { id: 2, name: 'Đôi gậy Carbon Black Diamond', checked: true, warning: 'Trầy nhẹ đầu kim loại', note: 'Khách đã thử độ dài gậy & chốt khóa', hasImage: true },
      { id: 3, name: 'Áo mưa bộ Gore-Tex Cỡ L', checked: true, note: 'Khách đã thử size vừa vặn' },
      { id: 4, name: 'Đèn pin đội đầu Naturehike 220LM', checked: false, warningText: 'CẦN BẬT THỬ ĐÈN TRƯỚC MẶT KHÁCH để đối soát pin sạc & 3 chế độ sáng' }
    ]
  },
  handover: {
    id: '#BK-7892',
    customer: 'Nguyễn Tuấn Anh',
    location: 'Cổng Trạm Tôn - VQG Hoàng Liên',
    time: '06:14 AM • 18/11/2024',
    escrow: '2.400.000 đ',
    gps: '22.3364° N, 103.7745° E',
    gpsAcc: 'Sai số ±3m (Khóa 9 vệ tinh)',
    timestamp: '18/11/2024 06:14:22 GMT+7',
    note: '"Khách lắng nghe kỹ hướng dẫn sử dụng gậy trekking và khóa an toàn."'
  },
  handoverReceipt: {
    id: '#BK-7892',
    receiptId: '#RCP-7892-DLV',
    customer: 'Nguyễn Tuấn Anh',
    cccd: '...589',
    time: '06:15 AM',
    date: '18/11/2024',
    gps: 'Cổng Trạm Tôn, Sa Pa, Lào Cai\n22.3512° N, 103.7745° E (±2.4m)',
    nextPlan: {
      time: '14:30 Chiều • 20/11/2024',
      qty: 4,
      desc: 'Dự kiến sau khi đoàn hạ sơn Fansipan',
      location: 'Bãi xe Bản Sín Chải (Chân núi Fansipan)'
    }
  },
  returnChecklist: {
    id: '#BK-7892',
    tour: 'Fansipan 3N2Đ',
    customer: 'Nguyễn Tuấn Anh',
    phone: '0982 *** 618',
    status: 'ĐOÀN VỪA HẠ SƠN LÚC 14:20',
    timeWindow: '14:15 - 14:45',
    location: 'Trạm dừng Bãi đỗ xe Bản Sín Chải',
    distance: 'Cách 300m',
    items: [
      { id: '#EQ-BL-4508', name: 'Balo trekking Deuter 45L', qty: 1, status: 'Đã nhận lại - Bám bụi nhẹ' },
      { id: '#EQ-GT-8812', name: 'Cặp Gậy trekking Carbon BD Trail ...', qty: 2, status: 'Đã nhận lại - Đủ 02 gậy' },
      { id: '#EQ-AM-1044', name: 'Áo mưa bộ Gore-Tex Cỡ L', qty: 1, status: 'Đã nhận - Còn ẩm ướt sau mưa', type: 'warn' },
      { id: '#EQ-DP-3301', name: 'Đèn pin đội đầu Naturehike 220Lm', qty: 1, status: 'Chưa nhận / Đang đối soát', type: 'danger' }
    ]
  },
  returnDetail: {
    customer: 'Nguyễn Tuấn Anh',
    cccd: '***589 • 0982 *** 618',
    tour: 'Fansipan 3N2Đ (#BK-7892)',
    time: '14:15 - 14:45',
    date: 'Hôm nay, 20/11',
    location: 'Bãi xe Bản Sín Chải (Chân Fansipan)',
    distance: 'CÁCH BẠN: 3.2 KM (~15 PHÚT)',
    items: [
      { id: '#EQ-BL-4508', name: 'Balo trợ lực Deuter Aircontact 45L', status: 'Bẩn nhẹ bên ngoài' },
      { id: '#EQ-GT-8812', name: 'Cặp gậy Trekking Carbon BD Trail Pro', status: 'Đủ 2 gậy, xước răm' },
      { id: '#EQ-AM-1044', name: 'Áo mưa bộ kỹ thuật Gore-Tex 3L (L)', status: 'Còn ẩm sương núi' },
      { id: '#EQ-DP-3301', name: 'Đèn pin đội đầu Naturehike 220Lm', status: 'Cần xác nhận biên bản thiếu phụ kiện', danger: true, note: 'Khách báo quên cáp Type-C tại lán 2,800m' }
    ]
  },
  conditionAssessment: {
    id: '#BK-7892',
    customer: 'Nguyễn Tuấn Anh',
    time: '14:35 • 20/11/2024',
    location: 'Bãi xe Bản Sín Chải',
    items: [
      { id: '#EQ-BL-4508', name: 'Balo trekking 45L Deuter ACT Lite', tag: 'Bẩn bùn nhẹ', desc: 'Bẩn bùn nhẹ do mưa rừng Fansipan, quai đeo và khung trợ lực nguyên vẹn, đủ bọc mưa.', time: '14:31' },
      { id: '#EQ-GT-8812', name: 'Đôi gậy Carbon Black Diamond Distance', tag: 'ĐẠT CHUẨN', desc: 'Bình thường, chốt gậy chắc chắn, đủ 02 đầu bọc cao su.' },
      { id: '#EQ-AM-1044', name: 'Áo mưa bộ Gore-Tex Cỡ L (Chống bão)', tag: 'ĐẠT CHUẨN', desc: 'Nguyên vẹn, không rách đường ép nhiệt, khách gấp gọn vào túi.' },
      { id: '#EQ-DP-3301', name: 'Đèn pin đội đầu Naturehike USB-C', tag: 'Mất dây sạc Type-C', danger: true, desc: 'Mất dây sạc Type-C dã ngoại (Khách báo rơi tại lán 2.800m) - Đã ghi nhận để Kho thẩm định.', time: '14:33' }
    ]
  },
  taskHistory: {
    staff: 'Nguyễn Văn Tuấn',
    id: 'ST-8821',
    stats: { total: 14, issues: 2, sync: '100%' },
    history: [
      { id: '#BK-9024', type: 'BÀN GIAO THIẾT BỊ', time: 'Hôm nay, 08:30', customer: 'Lê Hoàng Nam', phone: '0912***456', loc: 'Hub Sa Pa — Khách sạn Mường Hoa', items: 'D1 Lều Eureka Apex 3P, 02 Gậy leo núi, 01 Túi ngủ', status: 'HOÀN HẢO — KHÔNG SỰ CỐ' },
      { id: '#BK-8841', type: 'THU HỒI THIẾT BỊ', time: 'Hôm qua, 17:15', customer: 'Trần Minh Quân', phone: '0988***112', loc: 'Trạm dừng chân Tà Năng', items: '01 Bếp dã ngoại Soto', status: 'GHI NHẬN HIỆN TRẠNG THỰC ĐỊA', danger: true },
      { id: '#BK-8790', type: 'THU HỒI THIẾT BỊ', time: '2 ngày trước, 14:00', customer: 'Đặng Thùy Dung', phone: '0903***789', loc: 'Điểm hẹn Trạm xe khách Phan Dũng', items: 'D2 Ba lô Deuter, 02 Áo mưa', status: 'ĐÃ THU HỒI ĐỦ — HOÀN CỌC 100%' },
      { id: '#BK-8655', type: 'BÀN GIAO THIẾT BỊ', time: '3 ngày trước, 06:45', customer: 'Phạm Quốc Bảo', loc: 'Chân đèo Ô Quy Hồ', items: '01 Garmin inReach Mini 2', status: 'BÀN GIAO & TEST SOS THÀNH CÔNG' }
    ]
  }
};
