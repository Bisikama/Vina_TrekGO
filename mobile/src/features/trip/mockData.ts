export const TRIP_MOCK_DATA = {
  tripName: 'Chinh phục Đỉnh Fansipan qua Sống Lưng Trâu 3N2Đ',
  tripId: 'TG-8924-VN',
  startTime: '05:00 • 18/11/2024',
  location: 'Sa Pa Hub (Số 02 Cầu Mây)',
  leader: 'Hoàng Văn Nam (Lvl 2)',
  checkIn: {
    total: 12,
    checkedIn: 10,
    valid: 10,
    equipmentCheck: 1,
    notArrived: 1,
    percentage: 83,
  },
  members: [
    {
      id: 'TK-5512',
      name: 'Đặng Thái Hoàng',
      status: 'ĐÃ CHECK-IN',
      time: '05:42 • Đã quét QR',
      tags: ['Cọc Escrow 100%', 'Bảo hiểm PVI Active', 'Đã cấp: Lều 2P & Gậy leo núi Hub'],
      image: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    },
    {
      id: 'TK-5519',
      name: 'Vũ Mai Linh',
      status: 'CẢNH BÁO Y TẾ',
      time: '05:48 • Check-in có điều kiện',
      tags: ['Đã ký cam kết tiền sử hạ đường huyết', 'Cần xếp đi ở tốp giữa'],
      image: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    },
    {
      id: 'TK-5524',
      name: 'Nguyễn Tuấn ...',
      status: 'THIẾU THIẾT BỊ',
      time: 'Về QR: Hợp lệ',
      tags: ['Chưa ký nhận Garmin InReach tại Hub'],
      image: null,
      initials: 'TA',
    },
    {
      id: 'TK-5530',
      name: 'Lê Hồng Phúc',
      status: 'CHƯA ĐẾN',
      time: 'Taxi trễ 15 phút (06:05 tới)',
      tags: ['Leader đã liên lạc 05:45'],
      image: null,
      initials: 'HP',
    },
  ],
  mapData: {
    currentCheckpoint: 'Trạm Tôn → Suối Lạnh (km 4.2)',
    safeCount: '12/12 AN TOÀN',
    speed: 'ĐOÀN: 2.4 km/h (km 4.2)',
    eta: '11:30 ETA',
    groups: [
      {
        id: 1,
        name: 'Tốp Giữa Di Chuyển Ổn Định',
        members: '10/12 Trekker',
        status: 'Cự ly dãn khối < 30m',
        action: 'ĐỀU BƯỚC',
        icon: 'walk',
      },
      {
        id: 2,
        name: 'Vũ Mai Linh & Chốt Lê Bình',
        members: 'Nghỉ bù nước 3 phút',
        status: 'HR 118 bpm',
        action: 'Cách Tốp: 80m',
        icon: 'person',
      },
      {
        id: 3,
        name: 'Đội Porter Tiền Trạm (A Tủa)',
        members: '4 Người',
        status: 'Đã tới Lán 2.800m dựng lều',
        action: 'ĐÃ ĐẾN',
        icon: 'backpack',
      },
    ],
  },
  deviationData: {
    deviationDistance: '+180m',
    message: 'Bạn đang đi xa khỏi lối mòn an toàn',
    description: 'Đoạn sườn bạn đang đi có độ dốc >35° đổ về khe suối cạn trơn trượt, ngoài phạm vi bảo hộ của kiểm lâm VFRS.',
    stats: {
      time: '04:18',
      distance: '9.8',
      speed: '2.1',
      elevation: '1,085',
    },
  },
  rerouteData: {
    deviationDistance: '240m',
    message: 'Đoàn đang lệch 240m so với lộ trình gốc',
    reason: 'Đoạn vượt suối Km 14 đang ngập do mưa nguồn chảy xiết. Leader cần chọn lộ trình vòng an toàn hoặc chuyển nhánh dự phòng.',
    options: [
      {
        id: 'opt1',
        name: 'Nhánh Yên Ngựa Cắt Rừng Thông (Bypass B2)',
        distance: '+1.8 km (1h15)',
        elevation: '+120m / -80m',
        water: 'Có sẵn',
        recommended: true,
      },
      {
        id: 'opt2',
        name: 'Đường Rừng Già Qua Thung Lũng Trúc',
        distance: '+3.2 km (2h10)',
        elevation: '+280m dốc gắt',
        water: 'Đá trơn & trúc',
        recommended: false,
      },
      {
        id: 'opt3',
        name: 'Trở Về Trạm Kiểm Lâm Phan Dũng',
        distance: '4.5 km (Quay đầu)',
        elevation: '-350m xuôi đèo',
        water: 'Có sóng 4G',
        recommended: false,
      },
    ],
  },
  checkpointData: {
    name: 'Đồi Cỏ Lộng Gió',
    id: 'CP03',
    status: '3/6 điểm',
    locationStatus: '12 m tới tâm mốc',
    gpsAccuracy: '±3.5 m',
    radius: '≤ 50 m',
    time: '14:32',
  },
  safetyReportData: {
    channelName: 'KÊNH TÁC CHIẾN MẶT ĐẤT',
    incident: {
      type: 'Y tế / Chấn thương nhẹ (Trẹo cổ chân / Chuột rút)',
      severity: 'Cấp độ 2 - Cần can thiệp sơ cứu tại chỗ, tiếp tục theo dõi',
      time: '11:15',
      location: 'Km 4.8',
      gps: '22.3491° N, 103.7712° E',
      elevation: '2,350m',
      victim: 'Vũ Mai Linh',
      victimId: 'TK-5519',
      actions: 'Đã nẹp thun cố định cổ chân phải, chườm lạnh đá ngoài bằng túi tuyết nhân tạo, chuyển balo 8kg cho Porter Sùng A Páo mang giúp. Nạn nhân tỉnh táo, tiếp xúc tốt.',
      supportRequest: 'Chưa cần SAR, yêu cầu Hub Sa Pa chuẩn bị thêm thuốc giảm đau tại Lán 2.800m.',
    }
  },
  groupChatData: {
    status: 'Đoàn Tà Năng – Phan D...',
    meshNetwork: 'Mạng Mesh Offline • 14/14 kết nối',
    members: '1 Lead • 1 Chốt • 2 Porter • 10 Trekker',
    pinnedMessage: {
      sender: 'Trưởng đoàn Nam (Lead)',
      time: '11:42',
      content: 'Trời sắp chuyển mưa lớn sau 40p. Cả đoàn dừng chân tại CP03 Đồi Cỏ ăn trưa nhanh, mặc áo mưa bọc balo, tuyệt đối không tách tốp!'
    },
    quickActions: ['👍 Tôi an toàn', '💧 Nghỉ uống nước', '⏱ Tới Checkpoint'],
    radarWarning: 'Cảnh báo Radar: Phát hiện khối mây dông cách 3km. Khuyến cáo kiểm tra đồ chống nước.',
    messages: [
      { sender: 'Hub Đức Trọng (HQ)', role: 'STAFF', time: '10:15', content: 'Đã bàn giao đủ 14 bộ đàm VHF kênh 3 và kích hoạt gói bảo hiểm cứu nạn SAR vệ tinh cho cả đoàn.', extra: 'Mã cấp phép: #SAR-VNT-8890', isMe: false },
      { sender: 'Nam (Lead)', role: 'LEADER', time: '11:38', content: 'Đội Porter đã mang thêm 4 túi trùm balo chống nước dự phòng sẵn tại điểm nghỉ trưa rồi nhé các bạn.', isMe: false },
      { sender: 'Linh (Trekker)', time: '11:45', content: 'Mây đen đang kéo về đỉnh đồi rồi mọi người ơi, gió bắt đầu lạnh rồi nè.', hasImage: true, location: 'Đồi Cỏ Cháy • Trạm dừng CP03', gps: "11°34'12.4\"N 108°28'55.1\"E", isMe: false },
      { sender: 'Bạn', time: '11:48', content: 'Em với anh Tuấn đang cách CP03 khoảng 300 mét, đang tăng tốc nhập đoàn ngay!', isMe: true, pending: true },
    ]
  },
  summaryData: {
    title: 'Tổng Kết & Nghiệm Thu Hiện Trường',
    status: 'HOÀN THÀNH 100% LỘ TRÌNH AN TOÀN',
    stats: {
      records: '12/12',
      accidents: '0',
      equipment: '100%'
    },
    attendance: {
      registered: 12,
      started: 12,
      checkpoint: 12,
      finished: 12,
      note: 'Thành viên Vũ Mai Linh bị giãn dây chằng nhẹ bàn chân tại dốc Km 8. Sơ cứu nẹp thun tại chỗ, hoàn thành chặng cuối dưới sự hộ tống sát sao của Porter trưởng.'
    },
    checkpoints: [
      { id: 1, name: 'Cổng Trạm Tôn (Xuất phát)', time: '08:30 (Đúng giờ)', sub: 'Hoàn thành kiểm tra tư trang' },
      { id: 2, name: 'Trạm Suối Lạnh (Ăn trưa)', time: '11:45 (+15p)', sub: 'Nghỉ thêm do xử lý sơ cứu', warning: true },
      { id: 3, name: 'Lán Nghỉ 2.800m', time: '16:50 (-10p)', sub: 'Nhận chỗ ngủ và trữ nước' },
      { id: 4, name: 'Chóp Đỉnh Fansipan 3.143m', time: '09:15 N2 (-15p)', sub: 'Đón bình minh và gắn cờ' },
      { id: 5, name: 'Sín Chải (Bế mạc Hub)', time: '14:20 N3 (+20p)', sub: 'Bàn giao lên xe trung chuyển về Sa Pa Hub', warning: true }
    ],
    gps: { distance: '19.8 km', deviation: '+400m', elevation: '+1,420 m', incline: '24%' }
  }
};
