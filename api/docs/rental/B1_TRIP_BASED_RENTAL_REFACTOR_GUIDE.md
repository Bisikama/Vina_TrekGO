# TrekGo Rental B1 — Refactor từ Booking-based sang TripMember-based

## Mục tiêu mới

B1 gồm RB-API-101 → 104. Sau refactor:

- Quyền thuê đến từ `TripMember`, không đến từ `Booking`.
- Cả `USER` và `LEADER` có thể gọi B1.
- `PUBLIC` và `PRIVATE` dùng chung một Rental flow.
- Initial rental vẫn lấy thời gian mặc định từ Trip.
- Nếu `(tripId, userId)` đã có RentalOrder chưa kết thúc thì không tạo initial quote/order thứ hai. Sau này thay đổi phải đi qua `RentalAmendment`.
- B1 chưa code Amendment; chỉ chặn tạo hợp đồng thứ hai để không phá thiết kế.

---

# 1. Thứ tự sửa

1. `prisma/schema.prisma`
2. `src/modules/trips/infrastructure/adapters/prisma-trip.adapter.ts`
3. Đồng bộ Public Booking CONFIRMED -> TripMember (ở Area A / Booking source, không có trong zip hiện tại)
4. `rental-context.port.ts`
5. `prisma-rental-context.adapter.ts`
6. `rental-ordering.rules.ts`
7. 4 B1 use cases
8. DTO + Controllers
9. `rental-quote.port.ts` + `prisma-rental-quote.adapter.ts`
10. error codes
11. `b1-rental-flow.spec.ts`

---

# 2. Prisma schema — thay đổi tối thiểu cho B1

## 2.1 Thêm LEADER vào TripMemberRole

```prisma
enum TripMemberRole {
  LEADER
  HOST
  MEMBER

  @@map("trip_member_role")
}
```

## 2.2 Thêm quan hệ RentalQuote -> TripMember

Trong `TripMember` thêm:

```prisma
rentalQuotesViaTripMemberId RentalQuote[] @relation("R_RentalQuote_trip_member_id")
```

## 2.3 RentalQuote không còn bắt buộc Booking

Giữ `bookingId` nullable tạm thời để source B2 cũ vẫn tồn tại trong branch hiện tại. B1 mới **không đọc Booking** và luôn tạo quote với `bookingId = null`.

```prisma
model RentalQuote {
  id                     String            @id @default(uuid()) @db.Uuid
  userId                 String            @map("user_id") @db.Uuid
  tripId                 String            @map("trip_id") @db.Uuid
  tripMemberId           String            @map("trip_member_id") @db.Uuid

  // Legacy trace field. Không còn là eligibility dependency.
  bookingId              String?           @map("booking_id") @db.Uuid
  recipientParticipantId String?           @map("recipient_participant_id") @db.Uuid

  // Trong B1 mới recipientSnapshot chính là renter/contract signer snapshot.
  recipientSnapshot      Json              @map("recipient_snapshot")

  pickupPointId          String            @map("pickup_point_id") @db.Uuid
  returnPointId          String            @map("return_point_id") @db.Uuid

  contextVersion         Int               @map("context_version")
  rentalPolicyId         String            @map("rental_policy_id") @db.Uuid
  rentalStartAt          DateTime          @map("rental_start_at") @db.Timestamptz(6)
  rentalEndAt            DateTime          @map("rental_end_at") @db.Timestamptz(6)
  plannedHandoverAt      DateTime          @map("planned_handover_at") @db.Timestamptz(6)
  plannedReturnAt        DateTime          @map("planned_return_at") @db.Timestamptz(6)
  occupiedStartAt        DateTime          @map("occupied_start_at") @db.Timestamptz(6)
  occupiedEndAt          DateTime          @map("occupied_end_at") @db.Timestamptz(6)
  rentalFee              Decimal           @map("rental_fee") @db.Decimal(12, 2)
  totalDeposit           Decimal           @map("total_deposit") @db.Decimal(12, 2)
  totalAmount            Decimal           @map("total_amount") @db.Decimal(12, 2)
  currency               String            @default("VND") @db.Char(3)
  policySnapshot         Json              @map("policy_snapshot")
  status                 RentalQuoteStatus @default(ACTIVE)
  expiresAt              DateTime          @map("expires_at") @db.Timestamptz(6)
  version                Int               @default(1)
  createdAt              DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt              DateTime          @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  user                 User                @relation("R_RentalQuote_user_id", fields: [userId], references: [id])
  trip                 Trip                @relation("R_RentalQuote_trip_id", fields: [tripId], references: [id])
  tripMember           TripMember          @relation("R_RentalQuote_trip_member_id", fields: [tripMemberId], references: [id])
  booking              Booking?            @relation("R_RentalQuote_booking_id", fields: [bookingId], references: [id])
  recipientParticipant BookingParticipant? @relation("R_RentalQuote_recipient_participant_id", fields: [recipientParticipantId], references: [id])
  pickupPoint          PickupPoint         @relation("R_RentalQuote_pickup_point_id", fields: [pickupPointId], references: [id])
  returnPoint          PickupPoint         @relation("R_RentalQuote_return_point_id", fields: [returnPointId], references: [id])
  rentalPolicy         RentalPolicy        @relation("R_RentalQuote_rental_policy_id", fields: [rentalPolicyId], references: [id])

  rentalQuoteLinesViaQuoteId RentalQuoteLine[] @relation("R_RentalQuoteLine_quote_id")
  rentalOrderViaQuoteId      RentalOrder?      @relation("R_RentalOrder_quote_id")

  @@index([userId, status])
  @@index([tripId, userId, status])
  @@index([tripMemberId, status])
  @@index([bookingId, status])
  @@index([pickupPointId])
  @@index([returnPointId])
  @@index([rentalPolicyId])
  @@index([expiresAt])
  @@map("rental_quotes")
}
```

Trong `PickupPoint` thêm reverse relations:

```prisma
rentalQuotesViaPickupPointId RentalQuote[] @relation("R_RentalQuote_pickup_point_id")
rentalQuotesViaReturnPointId RentalQuote[] @relation("R_RentalQuote_return_point_id")
```

> `RentalOrder` vẫn để nguyên ở B1. Khi bắt đầu B2 mới chuyển `RentalOrder` sang `tripMemberId` và bỏ dependency Booking hoàn toàn. Đây là cách staged-refactor để bạn không phải sửa 100+ chỗ trong một lần.

---

# 3. Public Trip phải có TripMember cho Leader

File:

`src/modules/trips/infrastructure/adapters/prisma-trip.adapter.ts`

Trong `Session.create()` đổi phần `trip.create()` thành nested create:

```ts
async create(actorId: string, d: TripInput) {
  return view(
    await this.db.trip.create({
      data: {
        ...tripData(d),
        title: d.title,
        destinationId: d.destinationId,
        startAt: new Date(d.startAt),
        endAt: new Date(d.endAt),
        maxPax: d.capacity,
        tripType: 'PUBLIC',
        creatorId: actorId,
        leaderId: actorId,
        status: 'DRAFT',
        tripMembersViaTripId: {
          create: {
            userId: actorId,
            role: 'LEADER',
            status: 'ACTIVE',
            pickupPointId: d.pickupPointId,
          },
        },
      },
      include,
    }),
  )
}
```

Private Trip đã tạo HOST `TripMember` nên giữ nguyên.

## Public booking -> TripMember

Zip hiện tại **không có Booking module**, nên đoạn này phải đặt ở transaction xác nhận Booking bên Area A.

Ngay khi Booking chuyển thành `CONFIRMED`, đồng bộ các account thực sự thuộc Trip:

```ts
const booking = await tx.booking.findUniqueOrThrow({
  where: { id: bookingId },
  include: {
    bookingParticipantsViaBookingId: {
      where: { status: 'ACTIVE' },
      select: { userId: true },
    },
  },
})

const userIds = new Set<string>([
  booking.userId,
  ...booking.bookingParticipantsViaBookingId
    .map((p) => p.userId)
    .filter((id): id is string => !!id),
])

for (const memberUserId of userIds) {
  const existing = await tx.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId: booking.tripId,
        userId: memberUserId,
      },
    },
  })

  if (!existing) {
    await tx.tripMember.create({
      data: {
        tripId: booking.tripId,
        userId: memberUserId,
        role: 'MEMBER',
        status: 'ACTIVE',
        pickupPointId: booking.pickupPointId,
      },
    })
    continue
  }

  // Không hạ LEADER/HOST thành MEMBER.
  await tx.tripMember.update({
    where: { id: existing.id },
    data: {
      status: 'ACTIVE',
      pickupPointId: booking.pickupPointId,
      version: { increment: 1 },
    },
  })
}
```

Non-account participant (`BookingParticipant.userId = null`) không thể tự ký Rental Contract vì không có authenticated account.

---

# 4. rental-context.port.ts — thêm Trip-based context, chưa xóa legacy B2

File:

`src/modules/rental/ordering/application/ports/rental-context.port.ts`

Giữ các interface cũ để B2 chưa bị phá. Thêm:

```ts
export interface RentalTripMemberContext {
  id: string
  userId: string
  displayName: string
  phone: string | null
  role: string
  status: string
  accountStatus: string
  pickupPointId: string | null
  version: number
}

export interface RentalTripEligibilityContext {
  member: RentalTripMemberContext | null
  trip: RentalTripContext
  pickup: RentalPointContext
  dropoff: RentalPointContext
  rentalCutoffAt: Date
  contextVersion: number
  existingOpenOrder: {
    id: string
    status: string
  } | null
  activePolicy: RentalPolicyContext
}
```

Và mở rộng Port:

```ts
export interface RentalContextPort {
  // Legacy B2 path — xóa khi refactor B2.
  getByBookingId(
    bookingId: string,
    now: Date,
  ): Promise<RentalEligibilityContext | null>

  // B1 mới.
  getByTripId(
    tripId: string,
    userId: string,
    now: Date,
  ): Promise<RentalTripEligibilityContext | null>
}
```

---

# 5. prisma-rental-context.adapter.ts — thêm getByTripId()

File:

`src/modules/rental/ordering/infrastructure/adapters/prisma-rental-context.adapter.ts`

Không xóa `getByBookingId()` ở bước B1. Thêm import type `RentalTripEligibilityContext` và thêm method sau:

```ts
async getByTripId(
  tripId: string,
  userId: string,
  now: Date,
): Promise<RentalTripEligibilityContext | null> {
  const trip = await this.prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      title: true,
      tripType: true,
      status: true,
      startAt: true,
      endAt: true,
      version: true,
      pickupPointId: true,
      pickupPoint: {
        select: {
          id: true,
          name: true,
          address: true,
          updatedAt: true,
        },
      },
      tripMembersViaTripId: {
        where: { userId },
        take: 1,
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          pickupPointId: true,
          version: true,
          user: {
            select: {
              fullName: true,
              phone: true,
              status: true,
            },
          },
        },
      },
      tripTransportsViaTripId: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { sequence: 'asc' },
        select: {
          pickupPointId: true,
          returnPointId: true,
          meetingAt: true,
          returnAt: true,
          version: true,
          pickupPoint: {
            select: {
              id: true,
              name: true,
              address: true,
              updatedAt: true,
            },
          },
          returnPoint: {
            select: {
              id: true,
              name: true,
              address: true,
              updatedAt: true,
            },
          },
        },
      },
      tripTrailPlansViaTripId: {
        orderBy: { sequence: 'asc' },
        take: 1,
        select: { snapshotDifficulty: true },
      },
      weatherSnapshotsViaTripId: {
        orderBy: { observedAt: 'desc' },
        take: 1,
        select: {
          weatherCondition: true,
          riskSummary: true,
          rainProbabilityPercent: true,
        },
      },
    },
  })

  if (!trip) return null

  const policy = await this.prisma.rentalPolicy.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: [{ effectiveFrom: 'desc' }, { versionNo: 'desc' }],
  })

  if (!policy) {
    throw AppError.fromCode(
      RENTAL_ORDERING_ERROR_CODES.RENTAL_POLICY_NOT_CONFIGURED,
    )
  }

  const memberRow = trip.tripMembersViaTripId[0] ?? null
  const preferredPickupPointId =
    memberRow?.pickupPointId ?? trip.pickupPointId

  const transport =
    trip.tripTransportsViaTripId.find(
      (item) => item.pickupPointId === preferredPickupPointId,
    ) ?? trip.tripTransportsViaTripId[0] ?? null

  const pickupPoint = transport?.pickupPoint ?? trip.pickupPoint
  const returnPoint = transport?.returnPoint ?? pickupPoint

  if (!pickupPoint || !returnPoint) {
    throw AppError.fromCode('INVALID_RENTAL_STATE', {
      message: 'Trip chưa cấu hình điểm giao/trả cho Rental',
    })
  }

  const latestWeather = trip.weatherSnapshotsViaTripId[0] ?? null
  const weatherSummary =
    latestWeather?.riskSummary ?? latestWeather?.weatherCondition ?? null

  const existingOpenOrder = await this.prisma.rentalOrder.findFirst({
    where: {
      tripId,
      userId,
      status: { in: OPEN_RENTAL_ORDER_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  })

  const policySnapshot: RentalPolicySnapshot = {
    policyCode: policy.policyCode,
    versionNo: policy.versionNo,
    currency: policy.currency,
    dayCountMode: policy.dayCountMode,
    quoteTtlMinutes: policy.quoteTtlMinutes,
    paymentHoldMinutes: policy.paymentHoldMinutes,
    freeCancellationHours: policy.freeCancellationHours,
    cutoffHoursBeforeTrip: policy.cutoffHoursBeforeTrip,
    prepBufferMinutes: policy.prepBufferMinutes,
    returnBufferMinutes: policy.returnBufferMinutes,
    cleaningBufferMinutes: policy.cleaningBufferMinutes,
    overdueReviewMinutes: policy.overdueReviewMinutes,
    cancellationRules: toJsonSafeValue(policy.cancellationRules),
    effectiveFrom: policy.effectiveFrom.toISOString(),
    effectiveTo: policy.effectiveTo?.toISOString() ?? null,
  }

  const contextVersion = buildTripRentalContextVersion({
    tripVersion: trip.version,
    memberVersion: memberRow?.version ?? 0,
    transportVersion: transport?.version ?? 0,
    pickupUpdatedAt: pickupPoint.updatedAt,
    returnUpdatedAt: returnPoint.updatedAt,
  })

  return {
    member: memberRow
      ? {
          id: memberRow.id,
          userId: memberRow.userId,
          displayName: memberRow.user.fullName,
          phone: memberRow.user.phone,
          role: memberRow.role,
          status: memberRow.status,
          accountStatus: memberRow.user.status,
          pickupPointId: memberRow.pickupPointId,
          version: memberRow.version,
        }
      : null,
    trip: {
      id: trip.id,
      name: trip.title,
      status: trip.status,
      tripType: trip.tripType,
      startAt: trip.startAt,
      endAt: trip.endAt,
      timezone: process.env.TREKGO_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
      difficulty:
        trip.tripTrailPlansViaTripId[0]?.snapshotDifficulty ?? null,
      weatherSummary,
      rainProbabilityPercent:
        latestWeather?.rainProbabilityPercent != null
          ? Number(latestWeather.rainProbabilityPercent)
          : null,
    },
    pickup: {
      id: pickupPoint.id,
      name: pickupPoint.name,
      address: pickupPoint.address,
      scheduledAt: transport?.meetingAt ?? trip.startAt,
    },
    dropoff: {
      id: returnPoint.id,
      name: returnPoint.name,
      address: returnPoint.address,
      scheduledAt: transport?.returnAt ?? trip.endAt,
    },
    rentalCutoffAt: new Date(
      trip.startAt.getTime() - policy.cutoffHoursBeforeTrip * 3_600_000,
    ),
    contextVersion,
    existingOpenOrder: existingOpenOrder
      ? { id: existingOpenOrder.id, status: existingOpenOrder.status }
      : null,
    activePolicy: {
      id: policy.id,
      policyCode: policy.policyCode,
      versionNo: policy.versionNo,
      currency: policy.currency,
      dayCountMode: policy.dayCountMode,
      quoteTtlMinutes: policy.quoteTtlMinutes,
      paymentHoldMinutes: policy.paymentHoldMinutes,
      freeCancellationHours: policy.freeCancellationHours,
      cutoffHoursBeforeTrip: policy.cutoffHoursBeforeTrip,
      prepBufferMinutes: policy.prepBufferMinutes,
      returnBufferMinutes: policy.returnBufferMinutes,
      cleaningBufferMinutes: policy.cleaningBufferMinutes,
      overdueReviewMinutes: policy.overdueReviewMinutes,
      snapshot: policySnapshot,
    },
  }
}
```

Thêm helper cuối file:

```ts
function buildTripRentalContextVersion(input: {
  tripVersion: number
  memberVersion: number
  transportVersion: number
  pickupUpdatedAt: Date
  returnUpdatedAt: Date
}): number {
  const payload = JSON.stringify({
    tripVersion: input.tripVersion,
    memberVersion: input.memberVersion,
    transportVersion: input.transportVersion,
    pickupUpdatedAt: input.pickupUpdatedAt.toISOString(),
    returnUpdatedAt: input.returnUpdatedAt.toISOString(),
  })

  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0) & 0x7fffffff || 1
}
```

---

# 6. rental-ordering.rules.ts — thêm rule TripMember

Không xóa `evaluateRentalEligibility()` cũ ngay vì B2 còn dùng. Thêm function mới:

```ts
import type {
  RentalTripEligibilityContext,
} from '../ports/rental-context.port'

export type TripRentalEligibilityReason =
  | 'TRIP_MEMBERSHIP_REQUIRED'
  | 'TRIP_NOT_RENTAL_ELIGIBLE'
  | 'RENTAL_CUTOFF_PASSED'
  | null

export function evaluateTripRentalEligibility(
  context: RentalTripEligibilityContext,
  now: Date,
): {
  eligible: boolean
  reason: TripRentalEligibilityReason
} {
  if (
    !context.member ||
    context.member.status !== 'ACTIVE' ||
    context.member.accountStatus !== 'ACTIVE'
  ) {
    return {
      eligible: false,
      reason: 'TRIP_MEMBERSHIP_REQUIRED',
    }
  }

  // OPEN: đang mở; FULL: đủ người nhưng member hiện tại vẫn được thuê;
  // CLOSED: đóng đăng ký nhưng member hiện tại vẫn được thuê trước cutoff.
  const allowedTripStatuses = new Set(['OPEN', 'FULL', 'CLOSED'])

  if (!allowedTripStatuses.has(context.trip.status)) {
    return {
      eligible: false,
      reason: 'TRIP_NOT_RENTAL_ELIGIBLE',
    }
  }

  if (now.getTime() >= context.rentalCutoffAt.getTime()) {
    return {
      eligible: false,
      reason: 'RENTAL_CUTOFF_PASSED',
    }
  }

  return { eligible: true, reason: null }
}
```

Sửa `calculateOccupiedWindow()` để nhận structural context thay vì chỉ Booking context:

```ts
export function calculateOccupiedWindow(context: {
  pickup: RentalPointContext
  dropoff: RentalPointContext
  activePolicy: RentalPolicyContext
}): OccupiedWindow {
  // giữ nguyên body hiện tại
}
```

Sửa `formatPolicyVersion()` tương tự:

```ts
export function formatPolicyVersion(context: {
  activePolicy: RentalPolicyContext
}): string {
  return `${context.activePolicy.policyCode}-v${context.activePolicy.versionNo}`
}
```

---

# 7. RB-API-101 — get-rental-eligibility.use-case.ts

Thay command và execute bằng logic Trip:

```ts
export interface GetRentalEligibilityCommand {
  tripId: string
  userId: string
  now?: Date
}

async execute(command: GetRentalEligibilityCommand) {
  const now = command.now ?? new Date()

  const context = await this.contextPort.getByTripId(
    command.tripId,
    command.userId,
    now,
  )

  if (!context) {
    throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.TRIP_NOT_FOUND)
  }

  const decision = evaluateTripRentalEligibility(context, now)

  return {
    tripId: context.trip.id,
    eligible: decision.eligible,
    reason: decision.reason,
    member: context.member
      ? {
          tripMemberId: context.member.id,
          userId: context.member.userId,
          displayName: context.member.displayName,
          role: context.member.role,
          status: context.member.status,
        }
      : null,
    trip: {
      id: context.trip.id,
      name: context.trip.name,
      tripType: context.trip.tripType,
      status: context.trip.status,
      startAt: context.trip.startAt,
      endAt: context.trip.endAt,
      timezone: context.trip.timezone,
    },
    pickup: decision.eligible ? context.pickup : null,
    dropoff: decision.eligible ? context.dropoff : null,
    rentalCutoffAt: context.rentalCutoffAt,
    contextVersion: context.contextVersion,
    existingOpenOrder: context.existingOpenOrder,
    canCreateInitialRental:
      decision.eligible && !context.existingOpenOrder,
  }
}
```

Import `evaluateTripRentalEligibility` thay cho rule cũ.

---

# 8. RB-API-102 — get-rental-availability.use-case.ts

Command:

```ts
export interface GetRentalAvailabilityCommand {
  tripId: string
  productId: string
  userId: string
  now?: Date
}
```

Đầu `execute()`:

```ts
const context = await this.contextPort.getByTripId(
  command.tripId,
  command.userId,
  now,
)

if (!context) {
  throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.TRIP_NOT_FOUND)
}

const decision = evaluateTripRentalEligibility(context, now)
if (!decision.eligible) {
  throw AppError.fromCode(
    decision.reason === 'RENTAL_CUTOFF_PASSED'
      ? RENTAL_ORDERING_ERROR_CODES.RENTAL_CUTOFF_PASSED
      : decision.reason === 'TRIP_MEMBERSHIP_REQUIRED'
        ? RENTAL_ORDERING_ERROR_CODES.TRIP_MEMBERSHIP_REQUIRED
        : RENTAL_ORDERING_ERROR_CODES.TRIP_NOT_RENTAL_ELIGIBLE,
  )
}
```

Response đổi `bookingId` thành `tripId`:

```ts
return {
  tripId: command.tripId,
  productId: command.productId,
  availableCount,
  rentalWindow,
  checkedAt: now,
}
```

---

# 9. RB-API-103 — create-rental-quote.use-case.ts

Command mới:

```ts
export interface CreateRentalQuoteCommand {
  userId: string
  tripId: string
  items: Array<{ productId: string; quantity: number }>
  now?: Date
}
```

Context:

```ts
const context = await this.contextPort.getByTripId(
  command.tripId,
  command.userId,
  now,
)

if (!context) {
  throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.TRIP_NOT_FOUND)
}

const decision = evaluateTripRentalEligibility(context, now)
if (!decision.eligible) {
  // map giống API-102
}

if (context.existingOpenOrder) {
  throw AppError.fromCode(
    RENTAL_ORDERING_ERROR_CODES.RENTAL_AMENDMENT_REQUIRED,
    {
      details: {
        rentalOrderId: context.existingOpenOrder.id,
        rentalOrderStatus: context.existingOpenOrder.status,
      },
    },
  )
}

const renter = context.member!
```

Xóa `resolveRecipient()` khỏi B1.

Khi persist:

```ts
const persisted = await this.quotePort.createQuote({
  userId: command.userId,
  tripId: context.trip.id,
  tripMemberId: renter.id,
  bookingId: null,
  recipientParticipantId: null,
  recipientSnapshot: {
    tripMemberId: renter.id,
    userId: renter.userId,
    displayName: renter.displayName,
    phone: renter.phone,
    role: renter.role,
    status: renter.status,
  },
  pickupPointId: context.pickup.id,
  returnPointId: context.dropoff.id,
  contextVersion: context.contextVersion,
  rentalPolicyId: context.activePolicy.id,
  rentalStartAt: context.trip.startAt,
  rentalEndAt: context.trip.endAt,
  plannedHandoverAt: context.pickup.scheduledAt,
  plannedReturnAt: context.dropoff.scheduledAt,
  occupiedStartAt: occupiedWindow.occupiedFrom,
  occupiedEndAt: occupiedWindow.occupiedUntil,
  rentalFee: toPrismaDecimalVnd(totalRentalFee),
  totalDeposit: toPrismaDecimalVnd(totalDeposit),
  totalAmount: toPrismaDecimalVnd(totalAmount),
  currency: quoteCurrency,
  policySnapshot: {
    ...context.activePolicy.snapshot,
    policyVersion: formatPolicyVersion(context),
  },
  expiresAt,
  lines: /* giữ mapping hiện tại */,
})
```

Response đầu:

```ts
return {
  id: persisted.id,
  tripId: context.trip.id,
  renter: {
    tripMemberId: renter.id,
    displayName: renter.displayName,
    role: renter.role,
  },
  // phần còn lại giữ như hiện tại
}
```

---

# 10. rental-quote.port.ts

Sửa record:

```ts
export interface CreateRentalQuoteRecord {
  userId: string
  tripId: string
  tripMemberId: string

  // Legacy, B1 mới truyền null.
  bookingId: string | null
  recipientParticipantId: string | null

  recipientSnapshot: Record<string, unknown>
  pickupPointId: string
  returnPointId: string
  contextVersion: number
  rentalPolicyId: string
  rentalStartAt: Date
  rentalEndAt: Date
  plannedHandoverAt: Date
  plannedReturnAt: Date
  occupiedStartAt: Date
  occupiedEndAt: Date
  rentalFee: string
  totalDeposit: string
  totalAmount: string
  currency: string
  policySnapshot: Record<string, unknown>
  expiresAt: Date
  lines: CreateRentalQuoteLineRecord[]
}
```

---

# 11. prisma-rental-quote.adapter.ts

Trong `data` của `tx.rentalQuote.create()`:

```ts
data: {
  userId: data.userId,
  tripId: data.tripId,
  tripMemberId: data.tripMemberId,
  bookingId: data.bookingId,
  recipientParticipantId: data.recipientParticipantId,
  recipientSnapshot: data.recipientSnapshot as Prisma.InputJsonValue,
  pickupPointId: data.pickupPointId,
  returnPointId: data.returnPointId,
  // phần còn lại giữ nguyên
}
```

---

# 12. RB-API-104 — get-rental-recommendations.use-case.ts

Command:

```ts
export interface GetRentalRecommendationsCommand {
  tripId: string
  userId: string
  categoryId?: string
  limit: number
  now?: Date
}
```

Đổi context đầu use-case sang:

```ts
const context = await this.contextPort.getByTripId(
  command.tripId,
  command.userId,
  now,
)
```

và dùng `evaluateTripRentalEligibility()` giống 102/103.

Phần scoring rule giữ nguyên.

---

# 13. ordering.dto.ts

B1 mới:

```ts
export const RentalTripIdParamSchema = z.object({
  tripId: z.string().uuid(),
})
export type RentalTripIdParamDto = z.infer<typeof RentalTripIdParamSchema>

export const RentalAvailabilityQuerySchema = z.object({
  tripId: z.string().uuid(),
  productId: z.string().uuid(),
})

export type RentalAvailabilityQueryDto = z.infer<
  typeof RentalAvailabilityQuerySchema
>

export const RentalQuoteBodySchema = z.object({
  tripId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
})

export type RentalQuoteBodyDto = z.infer<typeof RentalQuoteBodySchema>
```

`RentalRecommendationQuerySchema` giữ nguyên.

---

# 14. Controller API-101/104 — đổi Booking route thành Trip route

Tạo file mới:

`src/modules/rental/ordering/presentation/controllers/rental-trip.controller.ts`

```ts
@ApiTags('Rental Ordering - Trip')
@ApiBearerAuth('bearer')
@Controller('trips/:tripId')
export class RentalTripController {
  constructor(
    private readonly getRentalEligibilityUseCase: GetRentalEligibilityUseCase,
    private readonly getRentalRecommendationsUseCase: GetRentalRecommendationsUseCase,
  ) {}

  @Get('rental-eligibility')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  async getEligibility(
    @Param(new ZodValidationPipe(RentalTripIdParamSchema))
    params: RentalTripIdParamDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getRentalEligibilityUseCase.execute({
      tripId: params.tripId,
      userId,
    })
  }

  @Get('rental-recommendations')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  async getRecommendations(
    @Param(new ZodValidationPipe(RentalTripIdParamSchema))
    params: RentalTripIdParamDto,
    @Query(new ZodValidationPipe(RentalRecommendationQuerySchema))
    query: RentalRecommendationQueryDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getRentalRecommendationsUseCase.execute({
      tripId: params.tripId,
      userId,
      categoryId: query.categoryId,
      limit: query.limit,
    })
  }
}
```

Bạn có thể giữ Swagger decorators chi tiết từ controller cũ rồi đổi wording `Booking` -> `TripMember/Trip`.

Trong `ordering.module.ts`:

```ts
import { RentalTripController } from './presentation/controllers/rental-trip.controller'
```

và:

```ts
controllers: [
  RentalTripController,
  RentalOperationController,
  RentalOrderController,
],
```

Bỏ `RentalBookingController` khỏi `controllers`.

---

# 15. rental-operation.controller.ts — API-102/103

Đổi role:

```ts
@Roles(UserRole.USER, UserRole.LEADER)
```

API-102:

```ts
@ApiQuery({ name: 'tripId', required: true, format: 'uuid' })
```

execute:

```ts
return this.getRentalAvailabilityUseCase.execute({
  tripId: query.tripId,
  productId: query.productId,
  userId,
})
```

API-103 body:

```ts
required: ['tripId', 'items']
```

và:

```ts
tripId: { type: 'string', format: 'uuid' }
```

Bỏ `recipientParticipantId`.

Execute:

```ts
return this.createRentalQuoteUseCase.execute({
  userId,
  tripId: body.tripId,
  items: body.items,
})
```

Đồng thời nên thêm:

```ts
@HttpCode(HttpStatus.OK)
```

cho `POST /rentals/quote`, vì contract B1 là HTTP 200 chứ Nest POST mặc định là 201.

---

# 16. Error codes

Trong `rental-ordering.error-codes.ts` thêm:

```ts
TRIP_NOT_FOUND: 'TRIP_NOT_FOUND',
TRIP_MEMBERSHIP_REQUIRED: 'TRIP_MEMBERSHIP_REQUIRED',
TRIP_NOT_RENTAL_ELIGIBLE: 'TRIP_NOT_RENTAL_ELIGIBLE',
RENTAL_AMENDMENT_REQUIRED: 'RENTAL_AMENDMENT_REQUIRED',
```

Chưa xóa Booking error codes vì B2 cũ còn dùng.

Trong `error-definitions.ts` thêm:

```ts
[RT.TRIP_NOT_FOUND]: {
  status: 404,
  message: 'Trip not found',
  retryable: false,
},
[RT.TRIP_MEMBERSHIP_REQUIRED]: {
  status: 422,
  message: 'User is not an active member of this Trip',
  retryable: false,
},
[RT.TRIP_NOT_RENTAL_ELIGIBLE]: {
  status: 422,
  message: 'Trip is not eligible for rental',
  retryable: false,
},
[RT.RENTAL_AMENDMENT_REQUIRED]: {
  status: 409,
  message: 'An unfinished rental already exists; use the amendment flow',
  retryable: false,
},
```

---

# 17. B1 test phải đổi trước khi code xong

`b1-rental-flow.spec.ts` nên test ít nhất:

1. `PUBLIC + LEADER TripMember ACTIVE` -> eligible true.
2. `PRIVATE + HOST TripMember ACTIVE` -> eligible true.
3. `MEMBER ACTIVE` -> eligible true.
4. Không có TripMember -> eligible false / `TRIP_MEMBERSHIP_REQUIRED`.
5. Trip CANCELLED/COMPLETED -> ineligible.
6. Qua cutoff -> ineligible.
7. Availability không dùng participant quota.
8. Quote lưu `tripMemberId`, không cần `bookingId`.
9. Nếu đã có RentalOrder mở -> `RENTAL_AMENDMENT_REQUIRED`.
10. Recommendation vẫn rule-based cho cả PUBLIC và PRIVATE.

Mock port ở test staged-refactor:

```ts
contextPort = {
  getByBookingId: jest.fn(), // legacy B2
  getByTripId: jest.fn().mockResolvedValue(createTripContext()),
}
```

---

# 18. B2 compatibility guard tạm thời

Vì `RentalQuote.bookingId` đã nullable nhưng B2 cũ vẫn giả định quote luôn có Booking, `prisma-rental-order.adapter.ts` có thể báo TypeScript error.

Trong B1 branch, thêm guard tạm ở đầu create order:

```ts
const quotePointer = await this.prisma.rentalQuote.findUnique({
  where: { id: command.quoteId },
  select: { bookingId: true },
})

if (!quotePointer) {
  throw AppError.fromCode(RT.QUOTE_NOT_FOUND)
}

if (!quotePointer.bookingId) {
  throw AppError.fromCode(RT.INVALID_RENTAL_STATE, {
    message: 'Trip-based RentalOrder conversion will be implemented in B2 refactor',
  })
}
```

Và sau query `include: { booking: ... }`:

```ts
if (!quote.bookingId || !quote.booking) {
  throw AppError.fromCode(RT.INVALID_RENTAL_STATE)
}
```

Đây chỉ là **compile bridge**. Khi bắt đầu B2, phải bỏ guard này và chuyển create-order sang TripMember-based thật sự.

---

# 19. Flow B1 sau khi sửa

```text
USER / LEADER
    |
    | GET /trips/:tripId/rental-eligibility
    v
Trip tồn tại?
    |
    v
TripMember(tripId,userId) ACTIVE?
    |
    v
Trip status OPEN/FULL/CLOSED?
    |
    v
Chưa qua rentalCutoffAt?
    |
    +---- existing RentalOrder? ----> Có -> không tạo initial contract mới
    |                                      -> sau này dùng RentalAmendment
    |
    v
Catalog / Recommendation
    |
    v
Availability theo Trip window
    |
    v
POST /rentals/quote { tripId, items }
    |
    v
Quote snapshot
- tripId
- tripMemberId
- renter snapshot
- pickup/return point
- trip window
- price/deposit/policy
- KHÔNG reserve quantity
```

---

# 20. Rental Amendment — chưa code ở B1

Không thêm endpoint amendment vào B1. Chỉ chốt nguyên tắc:

- Một `(tripId,userId)` chỉ có một RentalOrder chưa kết thúc.
- Thuê thêm hoặc kéo dài thời gian không tạo RentalOrder thứ hai.
- Sau B2/B3 sẽ tạo `RentalAmendment` với type:
  - `ADD_ITEMS`
  - `EXTEND_DURATION`
  - `ADD_ITEMS_AND_EXTEND`
- Amendment phải quote -> accept online -> payment -> apply atomically.
- Nếu amendment thất bại/hết hạn, hợp đồng cũ giữ nguyên.

