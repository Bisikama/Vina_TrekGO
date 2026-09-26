1. Nhóm Identity & Authentication (Luật / Shared)
Loại bỏ các bảng tự lưu mật khẩu và session nội bộ cũ (password_hash, REFRESH_TOKENS, USER_IDENTITIES).
USERS: Mapped trực tiếp 1-1 với Supabase Auth qua auth_user_id (UID của auth.users). Backend phân quyền thông qua role (USER, LEADER, STAFF_WAREHOUSE, STAFF_LOGISTICS, ADMIN).
LEADER_PROFILES: Lưu thông tin duyệt Leader, chứng chỉ (certificates jsonb), số chuyến hoàn thành và kết quả kiểm tra năng lực.
2. Nhóm Trails, Checkpoints & TrailAccess (Bảo - Mảng A)
DESTINATIONS: Điểm đến lớn (Vùng miền, tọa độ trung tâm, map bounds).
SYSTEM_TRAILS: Cung đường hệ thống được verify sẵn, có giá price để mua quyền truy cập.
PERSONAL_TRAILS: Cung đường cá nhân do User tự tạo hoặc sinh ra từ GPS recording.
TRAIL_ACCESSES: Bản ghi sở hữu vĩnh viễn khi User mua System Trail để tổ chức Private Trip.
CHECKPOINTS & TRAIL_CHECKPOINTS: Trạm dừng chân, tọa độ PostGIS, bán kính nhận diện default_radius_meters, thứ tự sequence, cờ is_required.
3. Nhóm Trips, Bookings & Memberships (Bảo - Mảng A)
TRIPS: Phân biệt rõ trip_type (PUBLIC do Leader dẫn tour, PRIVATE do Host tổ chức). Hỗ trợ theo dõi active_trail_id, active_trail_type (SYSTEM/PERSONAL).
TRIP_TRAIL_PLANS & TRIP_TRAIL_SWITCHES: Quản lý danh sách trail dự phòng và lịch sử đổi đường khi có sự cố.
TRIP_TRANSPORTS: Quản lý xe đưa đón theo Trip (chỉ hiển thị biển số/tài xế cho booking đã xác nhận).
Tách biệt 2 luồng tham gia:
Public Trip: BOOKINGS (có TTL 15 phút giữ slot, tổng tiền vé) + BOOKING_PARTICIPANTS (danh sách người đi kèm).
Private Trip: PRIVATE_TRIP_INVITES (mã mời) + TRIP_MEMBERS (vai trò HOST/MEMBER, điểm danh).
4. Nhóm Rental, Inventory & Logistics (Quân - Mảng B)
Tập trung hoàn toàn vào mô hình Cho thuê (Rental), loại bỏ bán lẻ mua bán hàng hóa dư thừa:
RENTAL_PRODUCTS & EQUIPMENT_UNITS: Quản lý danh mục thiết bị và từng sản phẩm vật lý (asset_code, qr_code, vòng đời AVAILABLE, RESERVED, RENTED, MAINTENANCE, DAMAGED, LOST).
EQUIPMENT_RESERVATIONS: Khóa cứng thiết bị theo khoảng thời gian (start_at - end_at), chống trùng lịch (double-booking).
RENTAL_ORDERS & RENTAL_ORDER_LINES: Đơn thuê gắn với Booking (Public) hoặc TripMember (Private), tính tiền thuê + tiền cọc.
PACKAGES & PACKAGE_ITEMS: Gom các thiết bị vật lý vào túi/thùng dán mã QR để giao cho khách.
WAREHOUSE_TASKS & LOGISTICS_TASKS: Quy trình làm việc cho Staff Kho (pick, chụp ảnh bằng chứng trước giao, đóng gói) và Staff Logistics (nhận đồ, xác minh User, bàn giao tại điểm đón, thu hồi).
CONDITION_SNAPSHOTS, RETURN_INSPECTIONS, DEPOSIT_SETTLEMENTS: Biên bản kiểm tra 2 bước (Logistics sơ bộ + Kho xác nhận) và khấu trừ/hoàn cọc bất biến.
5. Nhóm GPS Tracking, Map 3D & Weather (Luật - Mảng C)
GPS_SESSIONS: Phiên tracking của từng user theo chuyến đi, lưu tổng quãng đường và đường đi thực tế actual_path dạng PostGIS LineString / GeoJSON (đã qua thuật toán làm mượt/rút gọn điểm).
GPS_LOCATIONS: Từng điểm tọa độ thô thu thập từ Mobile batch 10–30s, lưu dạng geography(Point, 4326) (index GIST) phục vụ tính toán không gian siêu tốc; áp dụng chính sách dọn dẹp sau 7–14 ngày.
ROUTE_DEVIATION_EVENTS: Cảnh báo và lịch sử đi lệch lộ trình (khoảng cách lệch, trạng thái DEVIATED / RECOVERED).
CHECKPOINT_EVENTS: Ghi nhận sự kiện đến checkpoint (idempotent), mở khóa và nộp bằng chứng hoàn thành nhiệm vụ.
WEATHER_SNAPSHOTS: Cache thời tiết và cảnh báo rủi ro (gió giật, mưa bão) theo tọa độ chuyến đi.
6. Nhóm Tài chính & Hệ thống chung (Shared)
INVOICES, PAYMENTS, REFUNDS: Hóa đơn đa nguồn (Tour, Rental, Mua Trail), hỗ trợ idempotency_key chống trừ tiền nhiều lần khi webhook retry.
RANKS, USER_RANKS, POINT_TRANSACTIONS, BADGES: Hệ thống tích điểm và danh hiệu khi tham gia trekking/hoàn thành checkpoint.
NOTIFICATIONS, AUDIT_LOGS, TRIP_REVIEWS, RENTAL_REVIEWS: Thông báo thời gian thực, đánh giá và lịch sử thao tác hệ thống.