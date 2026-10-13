# Hướng Dẫn & Giải Thích Chi Tiết: Transactional Outbox Pattern Trong Vina_TrekGO

Tài liệu này dành cho toàn bộ thành viên trong nhóm nhằm nắm vững bản chất, luồng dữ liệu và cách sử dụng **Transactional Outbox Pattern** & **Outbox Consumer** trong dự án **Vina_TrekGO**.

---

## I. Khái Niệm Dễ Hiểu Nhất: Ẩn Dụ "Quán Phở & Que Cắm Giấy"

Hãy tưởng tượng bạn bước vào một quán phở đông khách:

```
[ Khách Ăn Phở ] ──(Trả tiền)──> [ Thu Ngân (Service Lõi) ]
                                            │
                                            ├── 1. In hóa đơn thu tiền
                                            └── 2. Cắm mẩu giấy gọi món vào que sắt (BẢNG OUTBOX)
                                                                │
                                                                ▼
                                                [ Đầu Bếp (Outbox Consumer) ]
                                                            │
                                                            └── Thấy giấy mới -> Lấy ra nấu phở (Gửi Notification / Email)
```

1. **Thu ngân (Service Booking / Payment)**:
   - Nhận tiền của bạn $\rightarrow$ bấm máy in hóa đơn.
   - Thu ngân **xé một mẩu giấy gọi món cắm vào que sắt trên bàn bếp** $\rightarrow$ **Cái que sắt cắm giấy này chính là BẢNG OUTBOX!**
   - Thu ngân **KHÔNG tự chạy vào bếp nấu phở**. Thu ngân chỉ cắm giấy rồi quay sang phục vụ khách tiếp theo. Giao dịch diễn ra siêu nhanh (chỉ mất vài mili-giây).
2. **Đầu bếp (Outbox Consumer)**:
   - Cứ mỗi 2-3 giây lại ngó vào que sắt (bảng Outbox).
   - Thấy có mẩu giấy mới $\rightarrow$ Nhấc ra $\rightarrow$ Nấu phở bưng cho khách (Tạo thông báo vào MongoDB, gửi Email, gửi SMS...).

---

## II. Tại Sao Không Gọi Trực Tiếp Mà Phải Dùng Bảng Outbox? (Vấn Đề Dual-Write)

Nếu **KHÔNG CÓ** bảng Outbox, khi khách thanh toán tour thành công:
- Bước 1: Bạn cập nhật trạng thái Booking thành `CONFIRMED` trong PostgreSQL.
- Bước 2: Bạn gọi ngay lệnh lưu thông báo vào MongoDB (hoặc gọi dịch vụ gửi Email).

**Rủi ro nghiêm trọng:**
* **Trường hợp 1**: PostgreSQL lưu xong, nhưng đúng lúc đó mạng chập chờn hoặc MongoDB bị nghẽn $\rightarrow$ Khách bị trừ tiền, có vé nhưng **không nhận được bất kỳ thông báo hay email nào**.
* **Trường hợp 2**: Bạn gửi thông báo trước rồi mới lưu PostgreSQL $\rightarrow$ Nhỡ PostgreSQL bị lỗi rollback (trùng chỗ, xung đột vé) $\rightarrow$ Khách nhận được thông báo "Chúc mừng bạn đặt tour thành công" nhưng thực tế vé **chưa từng được tạo**!

👉 **Bảng Outbox ra đời để giải quyết việc này**:
Cập nhật bảng chính (`bookings`) và ghi vào bảng Outbox (`booking_outbox_events`) nằm trong **CÙNG 1 TRANSACTION CỦA POSTGRESQL** (tính chất ACID): Hoặc **cả hai cùng thành công**, hoặc **cùng bị hủy**. Không bao giờ có sự sai lệch dữ liệu!

---

## III. Khi Nào Dữ Liệu Được Ghi Vào Bảng Outbox?

> 📌 **Quy tắc vàng:** Dữ liệu được ghi vào Outbox **NGAY KHI** một hành động nghiệp vụ quan trọng vừa được lưu thành công vào Database PostgreSQL!

Ai là người ghi vào Outbox? **Chính là Service nghiệp vụ của bạn ghi**, không phải Consumer ghi!

### Bảng tổng hợp các mốc ghi Outbox trong Vina_TrekGO:

| Khi sự kiện xảy ra | Service chính làm gì trong PostgreSQL? | Dòng ghi vào bảng Outbox tương ứng |
| :--- | :--- | :--- |
| **Khách thanh toán xong tiền tour** | `bookings.status = 'PAID'` / `'CONFIRMED'` | Ghi `BOOKING_CONFIRMED` vào `booking_outbox_events` |
| **Khách bấm Hủy vé tour** | `bookings.status = 'CANCELLED'` | Ghi `BOOKING_CANCELLED` vào `booking_outbox_events` |
| **Khách vào Private Trip** | `trip_members.status = 'JOINED'` | Ghi `PRIVATE_TRIP_MEMBER_JOINED` vào `booking_outbox_events` |
| **Cổng MoMo/VNPAY báo tiền vào** | `payments.status = 'SUCCEEDED'` | Ghi `PAYMENT_SUCCEEDED` vào `payment_outbox_events` |
| **Khách trả xong đồ thuê** | `rental_orders.status = 'RETURNED'` | Ghi `RENTAL_PAID` vào `rental_outbox_events` |
| **Duyệt hoàn cọc thiết bị** | `deposit_settlements.status = 'SETTLED'` | Ghi `DEPOSIT_REFUND_SUCCEEDED` vào `rental_outbox_events` |

---

## IV. Cấu Trúc Bảng Outbox Trong Cơ Sở Dữ Liệu (Prisma)

Ví dụ bảng `booking_outbox_events` trong file `api/prisma/schema.prisma` (dòng 1760):

```prisma
model BookingOutboxEvent {
  id               String      @id @default(uuid()) @db.Uuid
  deduplicationKey String      @unique @map("deduplication_key") @db.VarChar(220)
  eventType        String      @map("event_type") @db.VarChar(140)
  aggregateType    String      @map("aggregate_type") @db.VarChar(100)
  aggregateId      String      @map("aggregate_id") @db.Uuid
  payload          Json
  status           EventStatus @default(PENDING)
  retryCount       Int         @default(0) @map("retry_count")
  lastError        String?     @map("last_error")
  createdAt        DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([status, createdAt])
  @@map("booking_outbox_events")
}
```

* **`deduplicationKey`**: Khóa chống trùng lặp (ví dụ `booking:123:confirmed:v1`).
* **`eventType`**: Tên sự việc vừa diễn ra (`BOOKING_CONFIRMED`, `PAYMENT_SUCCEEDED`...).
* **`payload`**: Nội dung chi tiết mẩu giấy (JSON chứa `userId`, `tripId`, `amount`, `bookingId`...).
* **`status`**: Trạng thái kỹ thuật: `PENDING` (chờ xử lý), `PROCESSED` (đã xử lý), `FAILED` (lỗi).

---

## V. Xem Code Thực Tế Đang Chạy Trong Dự Án

### 1. Phía Producer (Người ghi vào Outbox)
Xem tại [api/src/modules/bookings/booking-payment.consumer.ts](file:///c:/Users/Admin/Documents/tuHocNestJs/Vina_TrekGO/api/src/modules/bookings/booking-payment.consumer.ts#L140-L164):

```typescript
// Nằm chung trong 1 Database Transaction:
await this.db.$transaction(async (tx) => {
  // 1. Cập nhật booking thành PAID
  await tx.booking.update({
    where: { id: booking.id },
    data: { status: 'PAID', paidAt: payment.paidAt },
  })

  // 2. NGAY LẬP TỨC ghi vào bảng Outbox!
  await tx.bookingOutboxEvent.create({
    data: {
      deduplicationKey: `booking:${booking.id}:confirmed:v1`,
      eventType: 'BOOKING_CONFIRMED',
      aggregateType: 'Booking',
      aggregateId: booking.id,
      payload: {
        bookingId: booking.id,
        tripId: booking.tripId,
        userId: booking.userId,
        confirmedAt: now.toISOString(),
      },
    },
  })
})
```

---

### 2. Phía Consumer (Người đọc Outbox và làm việc)
Xem tại [api/src/modules/notifications/consumers/booking-notification.consumer.ts](file:///c:/Users/Admin/Documents/tuHocNestJs/Vina_TrekGO/api/src/modules/notifications/consumers/booking-notification.consumer.ts#L36-L79):

```typescript
@Interval(3000) // Chạy ngầm định kỳ mỗi 3 giây
async tick() {
  // 1. Đọc các sự kiện PENDING từ bảng Outbox
  const events = await this.db.bookingOutboxEvent.findMany({
    where: {
      status: { in: [EventStatus.PENDING, EventStatus.PROCESSED] },
      eventType: { in: ['BOOKING_CONFIRMED', 'BOOKING_CANCELLED'] },
    },
    take: 25,
  })

  // 2. Chuyển hóa sự kiện thành Thông Báo lưu vào MongoDB
  for (const event of events) {
    const payload = event.payload as Record<string, any>

    // Kiểm tra chống tạo trùng (Idempotency)
    const existing = await this.notificationsService.findByOutboxEventId(event.id)
    if (existing) continue

    if (event.eventType === 'BOOKING_CONFIRMED') {
      await this.notificationsService.createNotification({
        userId: payload.userId,
        title: 'Đặt chỗ thành công!',
        content: 'Chuyến trekking của bạn đã được xác nhận thành công...',
        notificationType: NotificationType.BOOKING_CONFIRMED,
        referenceType: ReferenceType.BOOKING,
        referenceId: payload.bookingId,
        metadata: { outboxEventId: event.id },
      })
    }
  }
}
```

---

## VI. Phân Công Công Việc Trong Nhóm (Team Workflow)

Cơ chế Outbox giúp các thành viên trong nhóm làm việc độc lập hoàn toàn, không dẫm chân lên nhau:

1. **Thành viên phụ trách Booking / Payment / Rental**:
   - Chỉ cần tập trung vào nghiệp vụ cốt lõi của mình trên PostgreSQL.
   - Khi có thay đổi trạng thái quan trọng (duyệt vé, hủy tour, thanh toán thành công), chỉ cần nhớ gọi thêm:
     ```typescript
     await tx.bookingOutboxEvent.create({ ... })
     ```
   - **Hoàn toàn không cần biết** bên Notifications dùng MongoDB hay lưu ở đâu, không cần import `NotificationsService`.

2. **Thành viên phụ trách Notifications**:
   - Viết các Consumer (`BookingNotificationConsumer`, `PaymentNotificationConsumer`) để đọc bảng Outbox và lưu thông báo vào MongoDB.
   - Xử lý giao diện chuông thông báo trên Web / Mobile.
   - Khi đang phát triển chưa muốn chạy ngầm, chỉ cần đặt `NOTIFICATION_CONSUMER_ENABLED=false` trong `.env`.

---

## VII. Các Câu Hỏi Thường Gặp (FAQ)

### Q1: Nếu Consumer bị tắt hoặc server sập thì sao?
* **Trả lời:** Không sao cả! Mẩu giấy sự kiện vẫn nằm an toàn trong bảng Outbox của PostgreSQL. Khi server hoặc Consumer bật lại, nó sẽ tiếp tục đọc các sự kiện chưa xử lý để gửi bù đầy đủ.

### Q2: Làm sao để người dùng không bao giờ nhận 2 thông báo trùng lặp?
* **Trả lời:** Trong MongoDB, mỗi thông báo lưu thêm `metadata.outboxEventId`. Trước khi tạo mới, Consumer luôn kiểm tra `findByOutboxEventId(event.id)`. Nếu đã có rồi thì bỏ qua ngay lập tức (**Tính Idempotency**).

### Q3: Bảng Outbox có bị phình to theo thời gian không?
* **Trả lời:** Có. Trong thực tế, các sự kiện sau 30-90 ngày đã ở trạng thái `PROCESSED` có thể được dọn dẹp định kỳ bằng một câu lệnh `DELETE ... WHERE created_at < NOW() - INTERVAL '30 days'` mà không làm ảnh hưởng đến dữ liệu chính.
