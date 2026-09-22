 // =============================================================================
// TREKGO PLATFORM - DATABASE DESIGN (DBML v2.0)
// Integrated Architecture: Area A (Tours/Trips), Area B (Rental), Area C (Auth/GPS/3D Map)
// Reference: master.md, bao.md, luat.md, quan.md
// =============================================================================

// =============================================================================
// 1. IDENTITY & AUTHENTICATION (Shared Platform / Supabase Auth Integration)
// Owner: Luật | No password stored in backend; identity managed via Supabase Auth
// =============================================================================

Table USERS {
  id uuid [pk]
  auth_user_id uuid [unique, not null] // Mapped 1-1 với Supabase auth.users(id)
  email varchar [unique, not null]
  full_name varchar [not null]
  phone varchar [null]
  avatar varchar [null]
  role varchar [not null, default: 'USER'] // USER, LEADER, STAFF_WAREHOUSE, STAFF_LOGISTICS, ADMIN
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, SUSPENDED
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    auth_user_id
    email
    role
  }
}

Table LEADER_PROFILES {
  user_id uuid [pk, ref: - USERS.id]
  verify_status varchar [not null, default: 'PENDING'] // PENDING, VERIFIED, REJECTED
  completed_trip_count int [default: 0]
  test_status varchar [default: 'NOT_TAKEN'] // NOT_TAKEN, PASSED, FAILED
  certificates jsonb [null] // Mảng link chứng chỉ, bằng cấp cứu hộ/dẫn đoàn
  experience_years int [default: 0]
  rejection_reason varchar [null]
  verified_by uuid [ref: > USERS.id, null]
  verified_at timestamp [null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
}

// =============================================================================
// 2. TRAILS, DESTINATIONS & CHECKPOINTS (Area A - Bảo & Area C - Luật)
// Network cung đường System, cung đường cá nhân Personal Trail và trạm Checkpoint
// =============================================================================

Table DESTINATIONS {
  id uuid [pk]
  name varchar [not null] // VD: Tà Năng - Phan Dũng, Fansipan, Chư Yang Sin
  description text [null]
  region varchar [not null] // NORTH, CENTRAL, SOUTH
  center_lat decimal(10, 7) [not null]
  center_lng decimal(10, 7) [not null]
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, INACTIVE
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
}

Table SYSTEM_TRAILS {
  id uuid [pk]
  destination_id uuid [ref: > DESTINATIONS.id, not null]
  code varchar [unique, not null] // VD: TN-PD-01
  name varchar [not null]
  description text [null]
  difficulty varchar [not null] // EASY, MODERATE, HARD, EXTREME
  distance_km decimal(6, 2) [not null]
  elevation_gain_m int [default: 0]
  route_geojson jsonb [not null] // LineString GeoJSON chuẩn hóa
  price decimal(12, 2) [default: 0] // Giá mua quyền tạo Private Trip (TrailAccess)
  status varchar [not null, default: 'ACTIVE'] // DRAFT, ACTIVE, INACTIVE
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    destination_id
    status
    difficulty
  }
}

Table PERSONAL_TRAILS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, not null] // User sở hữu
  destination_id uuid [ref: > DESTINATIONS.id, null]
  title varchar [not null]
  description text [null]
  difficulty varchar [default: 'MODERATE'] // EASY, MODERATE, HARD, EXTREME
  distance_km decimal(6, 2) [not null]
  elevation_gain_m int [default: 0]
  route_geojson jsonb [not null] // Tạo từ GPS Recording sau khi simplify
  status varchar [not null, default: 'READY'] // DRAFT, READY, ARCHIVED
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    user_id
    status
  }
}

Table TRAIL_ACCESSES {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, not null]
  system_trail_id uuid [ref: > SYSTEM_TRAILS.id, not null]
  source_type varchar [not null] // PURCHASED, PROMO, SYSTEM_FREE
  price_snapshot decimal(12, 2) [not null]
  payment_ref varchar [null]
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, REVOKED
  purchased_at timestamp [default: `now()`]

  indexes {
    (user_id, system_trail_id) [unique]
    user_id
  }
}

Table CHECKPOINTS {
  id uuid [pk]
  destination_id uuid [ref: > DESTINATIONS.id, not null]
  name varchar [not null] // VD: Đồi Lính, Đồi Cỏ, Suối Lạnh
  description text [null]
  latitude decimal(10, 7) [not null]
  longitude decimal(10, 7) [not null]
  point varchar [note: "PostGIS geography(Point, 4326)"]
  default_radius_meters int [default: 50] // Bán kính nhận diện check-in
  type varchar [not null] // START, CAMPSITE, SUMMIT, WATER_SOURCE, VIEWPOINT, END
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, INACTIVE
  created_at timestamp [default: `now()`]

  indexes {
    destination_id
    type
  }
}

Table TRAIL_CHECKPOINTS {
  id uuid [pk]
  system_trail_id uuid [ref: > SYSTEM_TRAILS.id, not null]
  checkpoint_id uuid [ref: > CHECKPOINTS.id, not null]
  sequence int [not null] // Thứ tự trạm trên route
  is_required boolean [default: true] // Trạm bắt buộc phải check-in để hoàn thành trip

  indexes {
    (system_trail_id, sequence) [unique]
    system_trail_id
    checkpoint_id
  }
}

Table PERSONAL_CHECKPOINTS {
  id uuid [pk]
  personal_trail_id uuid [ref: > PERSONAL_TRAILS.id, not null]
  name varchar [not null]
  latitude decimal(10, 7) [not null]
  longitude decimal(10, 7) [not null]
  sequence int [not null]
  info text [null]
  image_urls jsonb [null]

  indexes {
    (personal_trail_id, sequence) [unique]
  }
}

// =============================================================================
// 3. TRIPS, BOOKINGS & PRIVATE MEMBERSHIPS (Area A - Bảo)
// Tách biệt hoàn toàn luồng Public Trip (Booking/Payment) và Private Trip (Invite/Member)
// =============================================================================

Table TRIPS {
  id uuid [pk]
  trip_type varchar [not null] // PUBLIC (Leader dẫn), PRIVATE (User/Host tổ chức)
  title varchar [not null]
  description text [null]
  destination_id uuid [ref: > DESTINATIONS.id, not null]
  creator_id uuid [ref: > USERS.id, not null] // Leader (Public) hoặc Host (Private)
  leader_id uuid [ref: > USERS.id, null] // Leader phụ trách (bắt buộc với Public)
  active_trail_id uuid [not null] // ID của SystemTrail hoặc PersonalTrail đang active
  active_trail_type varchar [not null] // SYSTEM, PERSONAL
  start_date timestamp [not null]
  end_date timestamp [not null]
  status varchar [not null, default: 'DRAFT'] 
  // DRAFT, PUBLISHED, REGISTRATION_OPEN, REGISTRATION_CLOSED, IN_PROGRESS, COMPLETED, CANCELLED, INTERRUPTED
  min_pax int [default: 1]
  max_pax int [not null]
  current_pax int [default: 0]
  price_per_pax decimal(12, 2) [null] // Áp dụng cho Public Trip
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    trip_type
    status
    start_date
    destination_id
    creator_id
  }
}

Table TRIP_TRAIL_PLANS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  trail_id uuid [not null]
  trail_type varchar [not null] // SYSTEM, PERSONAL
  sequence int [not null]
  is_active boolean [default: false]
  snapshot_geojson jsonb [null] // Cache snapshot route tại thời điểm plan

  indexes {
    (trip_id, sequence) [unique]
  }
}

Table TRIP_TRAIL_SWITCHES {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  from_trail_id uuid [not null]
  to_trail_id uuid [not null]
  reason varchar [not null] // VD: Sạt lở, mưa lũ, chấn thương
  actor_id uuid [ref: > USERS.id, not null] // Leader hoặc Host
  switched_at timestamp [default: `now()`]
}

Table TRIP_CHECKPOINTS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  checkpoint_id uuid [ref: > CHECKPOINTS.id, null] // Link master checkpoint nếu có
  name varchar [not null]
  latitude decimal(10, 7) [not null]
  longitude decimal(10, 7) [not null]
  sequence int [not null]
  is_required boolean [default: true]
  radius_meters int [default: 50]
  status varchar [default: 'PENDING'] // PENDING, ARRIVED, SKIPPED, COMPLETED
  mission_title varchar [null]
  mission_description text [null]
  mission_type varchar [null] // QUIZ, PHOTO_EVIDENCE, CHECKIN_ONLY
  reward_points int [default: 0]

  indexes {
    (trip_id, sequence) [unique]
    trip_id
  }
}

Table TRIP_TRANSPORTS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  type varchar [not null] // PICKUP, DROPOFF
  location_name varchar [not null]
  latitude decimal(10, 7) [not null]
  longitude decimal(10, 7) [not null]
  scheduled_time timestamp [not null]
  vehicle_type varchar [not null] // 16_SEATER, 29_SEATER, 45_SEATER
  plate_number varchar [null] // Chỉ hiển thị khi Booking CONFIRMED
  driver_name varchar [null]
  driver_phone varchar [null]
  provider_name varchar [null]
  note text [null]
}

// Bảng BOOKINGS: Dành riêng cho Public Trip
Table BOOKINGS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  user_id uuid [ref: > USERS.id, not null] // Người đặt vé
  status varchar [not null, default: 'PENDING_PAYMENT'] // PENDING_PAYMENT, CONFIRMED, CANCELLED, COMPLETED
  participant_count int [not null]
  price_per_pax_snapshot decimal(12, 2) [not null]
  total_amount decimal(12, 2) [not null]
  expires_at timestamp [not null] // TTL giữ chỗ 15 phút
  payment_ref varchar [null]
  confirmed_at timestamp [null]
  cancelled_at timestamp [null]
  cancel_reason varchar [null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    trip_id
    user_id
    status
  }
}

Table BOOKING_PARTICIPANTS {
  id uuid [pk]
  booking_id uuid [ref: > BOOKINGS.id, not null]
  user_id uuid [ref: > USERS.id, null] // Null nếu thành viên chưa có tài khoản
  full_name varchar [not null]
  phone varchar [null]
  cccd varchar [null]
  emergency_contact varchar [null]
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, CANCELLED, NO_SHOW
  checkin_status varchar [not null, default: 'PENDING'] // PENDING, CHECKED_IN
  checked_in_at timestamp [null]

  indexes {
    booking_id
  }
}

// Dành riêng cho Private Trip
Table PRIVATE_TRIP_INVITES {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  code varchar [unique, not null]
  max_uses int [default: 20]
  used_count int [default: 0]
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, REVOKED, EXPIRED
  expires_at timestamp [not null]
  created_at timestamp [default: `now()`]
}

Table TRIP_MEMBERS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  user_id uuid [ref: > USERS.id, not null]
  role varchar [not null, default: 'MEMBER'] // HOST, MEMBER
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, REMOVED, LEFT
  joined_at timestamp [default: `now()`]
  attendance_status varchar [default: 'PENDING'] // PENDING, PRESENT, NO_SHOW
  attended_at timestamp [null]

  indexes {
    (trip_id, user_id) [unique]
    trip_id
    user_id
  }
}

// =============================================================================
// 4. EQUIPMENT RENTAL, INVENTORY & LOGISTICS (Area B - Quân)
// Quản lý thiết bị cho thuê, giữ chỗ (Reservation), chuẩn bị kho và giao/thu hồi
// =============================================================================

Table RENTAL_CATEGORIES {
  id uuid [pk]
  name varchar [not null] // VD: Lều trại, Balo trekking, Gậy leo núi, Đèn pin
  slug varchar [unique, not null]
  description text [null]
}

Table RENTAL_PRODUCTS {
  id uuid [pk]
  category_id uuid [ref: > RENTAL_CATEGORIES.id, not null]
  sku varchar [unique, not null]
  name varchar [not null]
  description text [null]
  daily_price decimal(12, 2) [not null]
  deposit_fee decimal(12, 2) [not null] // Tiền cọc định mức mỗi đơn vị
  images jsonb [null] // Mảng URL ảnh sản phẩm
  specifications jsonb [null] // Thông số: trọng lượng, chống nước, dung tích
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, INACTIVE
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    category_id
    sku
    status
  }
}

Table EQUIPMENT_UNITS {
  id uuid [pk]
  product_id uuid [ref: > RENTAL_PRODUCTS.id, not null]
  asset_code varchar [unique, not null] // Mã vạch quản lý tài sản: VD: TENT-4P-001
  qr_code varchar [unique, not null]
  status varchar [not null, default: 'AVAILABLE']
  // AVAILABLE, RESERVED, PICKED, PACKED, RENTED, RETURN_PENDING, MAINTENANCE, DAMAGED, LOST
  condition varchar [not null, default: 'GOOD'] // NEW, GOOD, USED, DAMAGED
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    product_id
    status
    asset_code
  }
}

Table RENTAL_ORDERS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, not null]
  trip_id uuid [ref: > TRIPS.id, not null] // Gắn trực tiếp chuyến đi
  booking_id uuid [ref: > BOOKINGS.id, null] // Nếu thuê từ Public Booking
  member_id uuid [ref: > TRIP_MEMBERS.id, null] // Nếu thuê từ Private Membership
  rental_start_date timestamp [not null]
  rental_end_date timestamp [not null]
  status varchar [not null, default: 'DRAFT']
  // DRAFT, PENDING_PAYMENT, PAID, PREPARING, READY_FOR_HANDOVER, ACTIVE, RETURN_PENDING, INSPECTED, COMPLETED, CANCELLED, EXPIRED
  rental_fee decimal(12, 2) [not null]
  total_deposit decimal(12, 2) [not null]
  total_amount decimal(12, 2) [not null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    user_id
    trip_id
    booking_id
    status
  }
}

Table RENTAL_ORDER_LINES {
  id uuid [pk]
  order_id uuid [ref: > RENTAL_ORDERS.id, not null]
  product_id uuid [ref: > RENTAL_PRODUCTS.id, not null]
  quantity int [not null]
  daily_price_snapshot decimal(12, 2) [not null]
  deposit_snapshot decimal(12, 2) [not null]
  charged_days int [not null]
}

Table EQUIPMENT_RESERVATIONS {
  id uuid [pk]
  rental_order_id uuid [ref: > RENTAL_ORDERS.id, not null]
  unit_id uuid [ref: > EQUIPMENT_UNITS.id, not null]
  start_at timestamp [not null]
  end_at timestamp [not null]
  status varchar [not null, default: 'RESERVED'] // RESERVED, RELEASED, FULFILLED

  indexes {
    (unit_id, start_at, end_at)
    rental_order_id
  }
}

Table PACKAGES {
  id uuid [pk]
  package_code varchar [unique, not null] // QR dán trên thùng/túi đồ giao khách
  order_id uuid [ref: > RENTAL_ORDERS.id, not null]
  status varchar [not null, default: 'PACKED'] // PACKED, IN_TRANSIT, HANDED_OVER, RETURNED, DISBANDED
  created_at timestamp [default: `now()`]
}

Table PACKAGE_ITEMS {
  id uuid [pk]
  package_id uuid [ref: > PACKAGES.id, not null]
  equipment_unit_id uuid [ref: > EQUIPMENT_UNITS.id, not null]

  indexes {
    (package_id, equipment_unit_id) [unique]
  }
}

Table WAREHOUSE_TASKS {
  id uuid [pk]
  order_id uuid [ref: > RENTAL_ORDERS.id, not null]
  package_id uuid [ref: > PACKAGES.id, null]
  staff_id uuid [ref: > USERS.id, null] // Staff Kho phụ trách
  status varchar [not null, default: 'OPEN']
  // OPEN, PICKING, CONDITION_CAPTURED, PACKED, READY, TRANSFERRED, CLOSED
  deadline timestamp [not null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    order_id
    status
    staff_id
  }
}

Table LOGISTICS_TASKS {
  id uuid [pk]
  order_id uuid [ref: > RENTAL_ORDERS.id, not null]
  package_id uuid [ref: > PACKAGES.id, not null]
  trip_id uuid [ref: > TRIPS.id, not null]
  staff_id uuid [ref: > USERS.id, null] // Staff Logistics phụ trách giao/thu hồi
  task_type varchar [not null] // HANDOVER, RETURN_COLLECT
  status varchar [not null, default: 'SCHEDULED']
  // SCHEDULED, PACKAGE_RECEIVED, USER_VERIFIED, HANDED_OVER, RETURN_DUE, RETURNED, NO_SHOW, CLOSED
  handover_time timestamp [null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    trip_id
    order_id
    status
    staff_id
  }
}

Table CONDITION_SNAPSHOTS {
  id uuid [pk]
  unit_id uuid [ref: > EQUIPMENT_UNITS.id, not null]
  snapshot_stage varchar [not null] // PRE_HANDOVER (trước giao), POST_RETURN (sau thu hồi)
  condition varchar [not null] // GOOD, SCRATCHED, DAMAGED, LOST
  notes text [null]
  image_urls jsonb [null] // Ảnh chụp làm bằng chứng
  taken_by uuid [ref: > USERS.id, not null]
  created_at timestamp [default: `now()`]

  indexes {
    unit_id
    snapshot_stage
  }
}

Table RETURN_INSPECTIONS {
  id uuid [pk]
  order_id uuid [ref: > RENTAL_ORDERS.id, not null]
  unit_id uuid [ref: > EQUIPMENT_UNITS.id, not null]
  inspector_id uuid [ref: > USERS.id, not null]
  stage varchar [not null] // LOGISTICS_PRELIMINARY, WAREHOUSE_FINAL
  status varchar [not null] // NORMAL, DAMAGED, LOST
  damage_fee decimal(12, 2) [default: 0]
  notes text [null]
  created_at timestamp [default: `now()`]

  indexes {
    order_id
    unit_id
  }
}

Table DEPOSIT_SETTLEMENTS {
  id uuid [pk]
  order_id uuid [ref: > RENTAL_ORDERS.id, not null]
  total_deposit decimal(12, 2) [not null]
  total_deduction decimal(12, 2) [default: 0] // Khấu trừ hư hại / mất mát
  refund_amount decimal(12, 2) [not null] // Số tiền hoàn lại cho User
  status varchar [not null, default: 'PENDING'] // PENDING, REFUNDED, PARTIALLY_REFUNDED, FORFEITED
  reason text [null]
  settled_at timestamp [null]
  created_at timestamp [default: `now()`]

  indexes {
    order_id
  }
}

Table MAINTENANCE_RECORDS {
  id uuid [pk]
  unit_id uuid [ref: > EQUIPMENT_UNITS.id, not null]
  staff_id uuid [ref: > USERS.id, not null]
  reason varchar [not null]
  cost decimal(12, 2) [default: 0]
  status varchar [not null, default: 'IN_PROGRESS'] // IN_PROGRESS, COMPLETED
  start_date timestamp [default: `now()`]
  completed_date timestamp [null]
}

// =============================================================================
// 5. GPS TRACKING, MAPLIBRE 3D & WEATHER (Area C - Luật)
// Quản lý GPS session, PostGIS spatial data, cảnh báo lệch route và check-in
// =============================================================================

Table GPS_SESSIONS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, not null]
  trip_id uuid [ref: > TRIPS.id, not null]
  status varchar [not null, default: 'ACTIVE'] // ACTIVE, PAUSED, STOPPED
  started_at timestamp [default: `now()`]
  ended_at timestamp [null]
  device_id varchar [null]
  actual_path varchar [note: "PostGIS geometry(LineString, 4326) simplified"]
  actual_path_geojson jsonb [null] // LineString GeoJSON phục vụ MapLibre render
  total_distance_meters decimal(10, 2) [default: 0]
  created_at timestamp [default: `now()`]

  indexes {
    (user_id, trip_id)
    status
  }
}

Table GPS_LOCATIONS {
  id uuid [pk]
  session_id uuid [ref: > GPS_SESSIONS.id, not null]
  point varchar [not null, note: "PostGIS geography(Point, 4326) with GIST Index"]
  latitude decimal(10, 7) [not null]
  longitude decimal(10, 7) [not null]
  accuracy decimal(6, 2) [not null] // Bán kính sai số mét
  speed decimal(6, 2) [null] // m/s
  heading decimal(5, 2) [null] // Góc 0 - 360 độ
  recorded_at timestamp [not null] // Thời điểm mobile thu thập tọa độ

  indexes {
    session_id
    recorded_at
  }
  // Ghi chú: Áp dụng retention policy tự động purge raw samples sau 7-14 ngày kể từ khi trip kết thúc
}

Table ROUTE_DEVIATION_EVENTS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  user_id uuid [ref: > USERS.id, not null]
  session_id uuid [ref: > GPS_SESSIONS.id, not null]
  status varchar [not null, default: 'DEVIATED'] // DEVIATED, RECOVERED
  start_at timestamp [default: `now()`]
  recovered_at timestamp [null]
  max_deviation_distance decimal(8, 2) [not null] // Khoảng cách lệch lớn nhất (mét)
  last_latitude decimal(10, 7) [not null]
  last_longitude decimal(10, 7) [not null]

  indexes {
    trip_id
    user_id
    status
  }
}

Table CHECKPOINT_EVENTS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  checkpoint_id uuid [ref: > CHECKPOINTS.id, not null]
  user_id uuid [ref: > USERS.id, not null]
  role varchar [not null] // USER, LEADER
  arrival_at timestamp [default: `now()`]
  status varchar [not null, default: 'ARRIVED'] // ARRIVED, VALIDATED
  mission_status varchar [default: 'LOCKED'] // LOCKED, UNLOCKED, COMPLETED, SKIPPED
  mission_answer text [null]
  evidence_url varchar [null]
  completed_at timestamp [null]

  indexes {
    (trip_id, checkpoint_id, user_id) [unique] // Đảm bảo tính idempotent
    trip_id
  }
}

Table WEATHER_SNAPSHOTS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, null]
  latitude decimal(10, 7) [not null]
  longitude decimal(10, 7) [not null]
  provider varchar [not null] // OPENWEATHER, TOMORROW_IO
  temperature decimal(4, 1) [not null]
  humidity decimal(4, 1) [not null]
  wind_speed decimal(5, 2) [not null]
  rain_probability decimal(4, 1) [null]
  weather_condition varchar [not null] // SUNNY, RAIN, FOG, THUNDERSTORM
  risk_summary varchar [not null] // SAFE, MODERATE_RAIN, HIGH_WIND, STORM_DANGER
  observed_at timestamp [not null]
  expires_at timestamp [not null] // Cache TTL (30 - 60 phút)

  indexes {
    (latitude, longitude)
    expires_at
  }
}

Table TRAIL_RECORDINGS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, not null]
  title varchar [not null]
  status varchar [not null, default: 'RECORDING'] // RECORDING, STOPPED, PROCESSED, SUBMITTED
  started_at timestamp [default: `now()`]
  ended_at timestamp [null]
  processed_geojson jsonb [null] // LineString sau khi làm mượt
  distance_km decimal(6, 2) [default: 0]
}

// =============================================================================
// 6. SHARED FINANCE: INVOICES, PAYMENTS & REFUNDS
// Hóa đơn và giao dịch thanh toán dùng chung cho Tour, Đồ thuê và Mua quyền Trail
// =============================================================================

Table INVOICES {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, not null]
  booking_id uuid [ref: > BOOKINGS.id, null]
  rental_order_id uuid [ref: > RENTAL_ORDERS.id, null]
  trail_access_id uuid [ref: > TRAIL_ACCESSES.id, null]
  invoice_type varchar [not null] // TRIP_BOOKING, RENTAL_FEE, TRAIL_PURCHASE, DEPOSIT_DEDUCTION
  subtotal_amount decimal(12, 2) [not null]
  discount_amount decimal(12, 2) [default: 0]
  total_amount decimal(12, 2) [not null]
  status varchar [not null, default: 'UNPAID'] // UNPAID, PAID, CANCELLED, REFUNDED
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    user_id
    status
    booking_id
    rental_order_id
  }
}

Table PAYMENTS {
  id uuid [pk]
  invoice_id uuid [ref: > INVOICES.id, not null]
  amount decimal(12, 2) [not null]
  transaction_ref varchar [unique, not null]
  payment_gateway varchar [not null] // VNPAY, MOMO, PAYOS, STRIPE
  status varchar [not null, default: 'PENDING'] // PENDING, SUCCESS, FAILED, EXPIRED
  idempotency_key varchar [unique, not null] // Chống duplicate giao dịch khi webhook retry
  paid_at timestamp [null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]

  indexes {
    invoice_id
    transaction_ref
    status
  }
}

Table REFUNDS {
  id uuid [pk]
  payment_id uuid [ref: > PAYMENTS.id, not null]
  amount decimal(12, 2) [not null]
  refund_type varchar [not null] // CANCEL_BOOKING, DEPOSIT_RETURN, RENTAL_CANCEL
  reason text [not null]
  status varchar [not null, default: 'PROCESSING'] // PROCESSING, SUCCESS, FAILED
  refund_transaction_ref varchar [unique, null]
  refunded_at timestamp [null]
  created_at timestamp [default: `now()`]
}

// =============================================================================
// 7. GAMIFICATION, REVIEWS & SYSTEM AUDIT
// Điểm thưởng (Gamification), Huy hiệu, Đánh giá và Nhật ký hệ thống
// =============================================================================

Table RANKS {
  id uuid [pk]
  name varchar [not null] // BRONZE, SILVER, GOLD, PLATINUM
  min_points int [not null]
  max_points int [not null]
  description varchar [null]
}

Table USER_RANKS {
  user_id uuid [pk, ref: - USERS.id]
  rank_id uuid [ref: > RANKS.id, not null]
  current_points int [default: 0]
  updated_at timestamp [default: `now()`]
}

Table POINT_TRANSACTIONS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, not null]
  points int [not null] // Dương: cộng, Âm: trừ
  type varchar [not null] // EARN_CHECKPOINT, EARN_TRIP, SPEND_RENTAL, PENALTY
  reference_type varchar [null] // CHECKPOINT, TRIP, RENTAL_ORDER
  reference_id uuid [null]
  description varchar [not null]
  created_at timestamp [default: `now()`]

  indexes {
    user_id
    type
  }
}

Table BADGES {
  id uuid [pk]
  name varchar [not null]
  icon_url varchar [not null]
  required_condition text [not null]
}

Table USER_BADGES {
  user_id uuid [ref: > USERS.id, not null]
  badge_id uuid [ref: > BADGES.id, not null]
  unlocked_at timestamp [default: `now()`]

  indexes {
    (user_id, badge_id) [pk]
  }
}

Table TRIP_REVIEWS {
  id uuid [pk]
  trip_id uuid [ref: > TRIPS.id, not null]
  user_id uuid [ref: > USERS.id, not null]
  booking_id uuid [ref: > BOOKINGS.id, null]
  rating int [not null] // 1 đến 5 sao
  comment text [null]
  created_at timestamp [default: `now()`]

  indexes {
    trip_id
    user_id
  }
}

Table RENTAL_REVIEWS {
  id uuid [pk]
  rental_order_id uuid [ref: > RENTAL_ORDERS.id, not null]
  user_id uuid [ref: > USERS.id, not null]
  product_id uuid [ref: > RENTAL_PRODUCTS.id, not null]
  rating int [not null] // 1 đến 5 sao
  comment text [null]
  created_at timestamp [default: `now()`]
}

Table NOTIFICATIONS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, not null]
  title varchar [not null]
  content text [not null]
  type varchar [not null] // TRIP_ALERT, DEVIATION_WARNING, RENTAL_REMINDER, SYSTEM
  reference_id uuid [null]
  is_read boolean [default: false]
  created_at timestamp [default: `now()`]

  indexes {
    user_id
    is_read
  }
}

Table AUDIT_LOGS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id, null]
  action varchar [not null] // CREATE, UPDATE, DELETE, OVERRIDE
  entity_type varchar [not null] // BOOKING, RENTAL_ORDER, TRIP, CHECKPOINT
  entity_id uuid [not null]
  old_values jsonb [null]
  new_values jsonb [null]
  created_at timestamp [default: `now()`]

  indexes {
    entity_type
    entity_id
  }
}
