// ==========================================
// 1. CORE: IDENTITY, AUTHENTICATION & PROFILES
// ==========================================

Table USERS {
  id uuid [pk]
  email varchar [unique]
  password_hash varchar [null]
  full_name varchar
  phone varchar
  cccd varchar [unique]
  avatar varchar
  role varchar//user,leader,...
  status varchar
  created_at timestamp
  updated_at timestamp
}

// Bảng lưu thông tin định danh từ bên thứ 3 (Google, Facebook)
Table USER_IDENTITIES {
  id uuid [pk]
  user_id uuid [ref: > USERS.id]
  provider varchar // GOOGLE
  provider_account_id varchar // ID trả về từ Google
  expires_at timestamp
  created_at timestamp
  updated_at timestamp

  indexes {
    (provider, provider_account_id) [unique]
  }
}

// BẢNG MỚI: Quản lý Refresh Token nội bộ của hệ thống (Session Management)
Table REFRESH_TOKENS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id]
  token text [unique] // Refresh Token (Nên mã hóa/hash trước khi lưu)
  device_info varchar // Nhận diện thiết bị (VD: "Chrome on Windows", "iPhone 15 Pro")
  ip_address varchar // Lưu IP đăng nhập để cảnh báo bảo mật
  is_revoked boolean // Đánh dấu true nếu user bấm Đăng xuất hoặc bị Admin kick
  expires_at timestamp // Thời hạn sống của token (VD: 30 ngày)
  created_at timestamp
  updated_at timestamp
}

Table LEADER_PROFILES {
  user_id uuid [pk, ref: - USERS.id]
  leader_type varchar // COMMUNITY, SYSTEM
  verify_status varchar // PENDING, VERIFIED, REJECTED
  certificates jsonb // Lưu mảng URL bằng cấp
  verified_by uuid [ref: > USERS.id]
  verified_at timestamp
  rejection_reason varchar
}

// ==========================================
// 2. TOURS, LOGISTICS & BOOKING
// ==========================================

Table TOURS {
  id uuid [pk]
  creator_id uuid [ref: > USERS.id]
  name varchar
  description text
  type varchar // PUBLIC, PRIVATE
  difficulty varchar // EASY, MEDIUM, HARD, EXTREME
  status varchar // DRAFT, OPEN, ONGOING, COMPLETED, CANCELLED
  base_price decimal
  insurance_price decimal
  min_pax int
  max_pax int
  start_time timestamp
  end_time timestamp
  created_at timestamp
  updated_at timestamp
}

Table LOCATIONS {
  id uuid [pk]
  name varchar
  type varchar // PICKUP, DROPOFF, CHECKPOINT
  latitude decimal
  longitude decimal
  metadata jsonb // Ảnh 360, ghi chú địa hình
}

Table TOUR_LOCATIONS {
  id uuid [pk]
  tour_id uuid [ref: > TOURS.id]
  location_id uuid [ref: > LOCATIONS.id]
  sequence int
  role_in_tour varchar
  schedule_time timestamp

  indexes {
    (tour_id, sequence) [unique]
  }
}



Table BOOKINGS {
  id uuid [pk]
  creator_id uuid [ref: > USERS.id]
  tour_id uuid [ref: > TOURS.id]
  pickup_tour_loc_id uuid [ref: > TOUR_LOCATIONS.id]
  dropoff_tour_loc_id uuid [ref: > TOUR_LOCATIONS.id]
  status varchar // PENDING, DEPOSIT_PAID, CONFIRMED, CANCELLED
  cancelled_at timestamp
  cancel_reason varchar
  created_at timestamp
}

Table BOOKING_PARTICIPANTS {
  id uuid [pk]
  booking_id uuid [ref: > BOOKINGS.id]
  user_id uuid [ref: > USERS.id, null] // Null nếu đi kèm nhưng chưa có account
  guest_name varchar
  guest_cccd varchar
  status varchar // CONFIRMED, CANCELLED
}

Table CHECK_INS {
  id uuid [pk]
  participant_id uuid [ref: > BOOKING_PARTICIPANTS.id]
  tour_location_id uuid [ref: > TOUR_LOCATIONS.id]
  staff_id uuid [ref: > USERS.id]
  status varchar // PRESENT, NO_SHOW
  checked_in_at timestamp
}

// ==========================================
// 3. INSURANCE & RISK MANAGEMENT
// ==========================================

Table INSURANCE_POLICIES {
  id uuid [pk]
  provider_name varchar
  premium_amount decimal
  coverage_amount decimal
}

Table BOOKING_INSURANCES {
  id uuid [pk]
  booking_id uuid [ref: > BOOKINGS.id]
  policy_id uuid [ref: > INSURANCE_POLICIES.id]
  status varchar // ACTIVE, CLAIMED, CANCELLED
}

Table INSURANCE_CLAIMS {
  id uuid [pk]
  booking_insurance_id uuid [ref: > BOOKING_INSURANCES.id]
  claim_details text
  claim_amount decimal
  approved_amount decimal
  status varchar // PENDING, APPROVED, REJECTED
  submitted_at timestamp
  resolved_at timestamp
}

Table INCIDENTS {
  id uuid [pk]
  tour_id uuid [ref: > TOURS.id]
  reporter_id uuid [ref: > USERS.id]
  type varchar // MEDICAL, WEATHER, LOST_PERSON
  latitude decimal
  longitude decimal
  status varchar // OPEN, RESOLVED
  created_at timestamp
  resolved_at timestamp
}


// ==========================================
// 4. E-COMMERCE: PRODUCTS, RENT/BUY & INVENTORY
// ==========================================

Table PRODUCTS {
  id uuid [pk]
  name varchar
  is_sellable boolean
  is_rentable boolean
  created_at timestamp
  updated_at timestamp
}



Table VARIANTS {
  id uuid [pk]

  product_id uuid [ref: > PRODUCTS.id]

  name varchar // VD: Voltage, Capacity, Color, Size

  created_at timestamp
  updated_at timestamp
}

Table VARIANT_OPTIONS {
  id uuid [pk]

  variant_id uuid [ref: > VARIANTS.id]

  value varchar // VD: 60V, 72V, Red, Blue, 20Ah

  created_at timestamp
  updated_at timestamp
}



Table PRODUCT_SKUS {
  id uuid [pk]

  product_id uuid [ref: > PRODUCTS.id]

  sku varchar [unique]

  sell_price decimal
  rent_price_per_day decimal
  deposit_percent decimal

  images varchar

  created_at timestamp
  updated_at timestamp
}

Table SKU_OPTIONS {
  sku_id uuid [ref: > PRODUCT_SKUS.id]
  variant_option_id uuid [ref: > VARIANT_OPTIONS.id]

  indexes {
    (sku_id, variant_option_id) [pk]
  }
}


Table SELL_INVENTORIES {
  id uuid [pk]

  sku_id uuid [ref: > PRODUCT_SKUS.id]

  total_quantity int
  available_quantity int
  reserved_quantity int

  created_at timestamp
  updated_at timestamp
}


Table EQUIPMENT_UNITS {
  id uuid [pk]

  sku_id uuid [ref: > PRODUCT_SKUS.id]

  serial_number varchar [unique]
  qr_code varchar [unique]

  status varchar
  // AVAILABLE
  // RESERVED
  // RENTED
  // MAINTENANCE
  // DAMAGED
  // LOST

  condition varchar
  // GOOD
  // USED
  // DAMAGED

  created_at timestamp
  updated_at timestamp
}



Table ORDERS {
  id uuid [pk]

  user_id uuid [ref: > USERS.id]

  booking_id uuid [ref: > BOOKINGS.id, null]

  status varchar
  // PENDING
  // PROCESSING
  // COMPLETED
  // CANCELLED

  created_at timestamp
  updated_at timestamp
}


Table ORDER_LINES_BUY {
  id uuid [pk]

  order_id uuid [ref: > ORDERS.id]

  sku_id uuid [ref: > PRODUCT_SKUS.id]

  quantity int

  unit_price decimal

  created_at timestamp
  updated_at timestamp
}


Table RENTAL_CONTRACTS {
  id uuid [pk]

  order_id uuid [ref: > ORDERS.id]

  start_date timestamp
  end_date timestamp
  actual_return_at timestamp

  total_deposit decimal
  refunded_deposit decimal
  penalty_amount decimal

  deposit_status varchar
  // HOLDING
  // REFUNDED
  // PARTIAL_REFUNDED

  status varchar
  // PENDING_HANDOVER
  // IN_USE
  // RETURNED
  // DISPUTED

  created_at timestamp
  updated_at timestamp
}


Table RENTAL_ITEMS {
  id uuid [pk]

  contract_id uuid [ref: > RENTAL_CONTRACTS.id]

  equipment_unit_id uuid [ref: > EQUIPMENT_UNITS.id]

  rent_price decimal
  item_deposit decimal

  return_status varchar
  // GOOD
  // DAMAGED
  // LOST

  penalty_fee decimal
  returned_at timestamp

  created_at timestamp
  updated_at timestamp
}



Table PRODUCT_SNAPSHOTS {
  id uuid [pk]

  order_id uuid [ref: > ORDERS.id]

  sku_id uuid [ref: > PRODUCT_SKUS.id]

  product_name varchar
  sku_value varchar

  unit_price decimal
  quantity int

  images varchar

  created_at timestamp
}

// ==========================================
// 5. FINANCE: INVOICE, PAYMENT & REFUND
// ==========================================

Table INVOICES {
  id uuid [pk]

  user_id uuid [ref: > USERS.id]

  booking_id uuid [ref: > BOOKINGS.id, null]
  order_id uuid [ref: > ORDERS.id, null]

  source_type varchar
  // TOUR_BOOKING
  // SHOP_ORDER
  // MIXED

  subtotal_amount decimal
  discount_amount decimal
  total_amount decimal

  status varchar
  // UNPAID
  // PARTIAL
  // PAID
  // REFUNDED
  // CANCELLED

  created_at timestamp
  updated_at timestamp
}



Table INVOICE_LINES {
  id uuid [pk]

  invoice_id uuid [ref: > INVOICES.id]

  item_type varchar
  // TOUR_FEE
  // INSURANCE
  // BUY_ITEM
  // RENT_FEE
  // RENT_DEPOSIT
  // PENALTY
  // DISCOUNT

  reference_id uuid [null]

  description varchar

  quantity int
  unit_price decimal
  amount decimal

  created_at timestamp
}


Table PAYMENTS {
  id uuid [pk]

  invoice_id uuid [ref: > INVOICES.id]

  amount decimal

  transaction_ref varchar [unique]
  payment_method varchar
  // VNPAY
  // MOMO
  // CASH
  // BANK_TRANSFER

  status varchar
  // PENDING
  // SUCCESS
  // FAILED
  // CANCELLED

  paid_at timestamp
  created_at timestamp
  updated_at timestamp
}


Table REFUNDS {
  id uuid [pk]

  payment_id uuid [ref: > PAYMENTS.id]

  amount decimal

  type varchar
  // CANCEL_TOUR
  // RETURN_DEPOSIT
  // ORDER_REFUND
  // PARTIAL_REFUND

  reason varchar

  status varchar
  // PROCESSING
  // SUCCESS
  // REJECTED

  transaction_ref varchar [unique, null]

  refunded_at timestamp
  created_at timestamp
}

// ==========================================
// 6. GAMIFICATION, SOCIAL, REVIEW & MEDIA
// ==========================================

Table RANKS {
  id uuid [pk]
  name varchar
  min_points int
  max_points int
  description varchar
}

Table USER_RANKS {
  user_id uuid [pk, ref: - USERS.id]
  rank_id uuid [ref: > RANKS.id]
  total_points int
  updated_at timestamp
}

Table POINT_TRANSACTIONS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id]
  points int
  type varchar // EARN, SPEND, PENALTY
  description varchar
  created_at timestamp
}

Table BADGES {
  id uuid [pk]
  name varchar
  required_points int
  description varchar
}

Table USER_BADGES {
  user_id uuid [pk, ref: > USERS.id]
  badge_id uuid [pk, ref: > BADGES.id]
  unlocked_at timestamp
}

Table TOUR_REVIEWS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id]
  tour_id uuid [ref: > TOURS.id]
  booking_id uuid [ref: > BOOKINGS.id]
  rating int
  comment text
  created_at timestamp
}

Table PRODUCT_REVIEWS {
  id uuid [pk]

  user_id uuid [ref: > USERS.id]
  order_id uuid [ref: > ORDERS.id]
  sku_id uuid [ref: > PRODUCT_SKUS.id]
  rating int
  comment text
  created_at timestamp
  updated_at timestamp
}

Table CHECKPOINT_LOGS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id]
  tour_location_id uuid [ref: > TOUR_LOCATIONS.id]
  completed_at timestamp
}

Table CHAT_ROOMS {
  id uuid [pk]
  tour_id uuid [ref: > TOURS.id]
  room_name varchar
  created_at timestamp
}

Table CHAT_MEMBERS {
  id uuid [pk]
  room_id uuid [ref: > CHAT_ROOMS.id]
  user_id uuid [ref: > USERS.id]
  joined_at timestamp
  left_at timestamp
}

Table MESSAGES {
  id uuid [pk]
  room_id uuid [ref: > CHAT_ROOMS.id]
  sender_id uuid [ref: > USERS.id]
  content text
  sent_at timestamp
}

Table ALBUMS {
  id uuid [pk]
  tour_id uuid [ref: > TOURS.id]
  name varchar
  created_at timestamp
}

Table PHOTOS {
  id uuid [pk]
  album_id uuid [ref: > ALBUMS.id]
  uploader_id uuid [ref: > USERS.id]
  url varchar
  is_360 boolean
  latitude decimal
  longitude decimal
  created_at timestamp
}

// ==========================================
// 7. SYSTEM LOGS & NOTIFICATIONS
// ==========================================

Table NOTIFICATIONS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id]
  title varchar
  content text
  type varchar // ALERT, PROMO, SYSTEM
  reference_id uuid
  is_read boolean
  created_at timestamp
}

Table AUDIT_LOGS {
  id uuid [pk]
  user_id uuid [ref: > USERS.id]
  entity_type varchar // BOOKING, PAYMENT, ORDER
  entity_id uuid
  action varchar // CREATE, UPDATE, DELETE
  old_data jsonb
  new_data jsonb
  created_at timestamp
}
