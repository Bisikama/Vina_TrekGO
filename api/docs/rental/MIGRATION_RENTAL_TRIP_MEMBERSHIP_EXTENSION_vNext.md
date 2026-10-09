# MIGRATION — Rental Trip-Membership + Extension (vNext)

## Breaking change summary

| Khu vực | Trước | vNext | FE/BE cần sửa |
|---|---|---|---|
| Eligibility | Booking/Trip hợp lệ | Trip membership hợp lệ | Đổi source context và route |
| Rental key | `bookingId` bắt buộc | `tripId + userId/membershipRef`; `bookingId?` audit | DB + DTO + query |
| Recipient | `BookingParticipant` | Trip member / user snapshot | DTO + relation |
| Rental duration | Bị giới hạn theo Trip | Có thể `rentalEndAt > tripEndAt` | UI date/return option + quote |
| Fee | Tính theo Trip duration | Tính theo Rental duration | Backend pricing |
| Extension | Ngoài MVP | In-scope | New state/API/UI/payment |
| Capacity extension | Không có | Delta reservation cycle | Transaction + availability |
| Return after Trip | Giả định Trip return | Phải có `returnOption` | UI + Delivery task |

## Contract changes

### Remove Booking as authorization source
- Replace `GET /bookings/:bookingId/rental-eligibility` with `GET /trips/:tripId/rental-eligibility`.
- Replace `bookingId` in availability/quote with `tripId`.
- Keep `bookingId?` only if needed for audit of historical/public-trip orders.

### Extension endpoints
- Add extension quote, create/apply request, payment and history APIs.
- Add error codes for membership missing, extension too late, extension capacity conflict and return option unavailable.

## Schema migration direction
- `RentalQuote.bookingId` -> nullable or remove.
- `RentalOrder.bookingId` -> nullable or remove.
- Replace `recipientParticipantId` with Trip-member/user based reference.
- Add membership snapshot/context version.
- Add `RentalExtensionRequest` (+ optional `RentalExtensionLine`).
- Reuse `RentalQuantityReservation.reservationCycle` for delta-window holds.

## Frontend migration
- Entry route should be Trip-centric, e.g. `/trips/:tripId/rentals`.
- Catalog header shows Trip membership/context, not Booking ownership.
- Quote/cart adds optional later return selection only from server-supported `returnOptions`.
- Rental detail shows `Extend rental` only when `allowedActions` contains extension action.
- Extension screen must show current due, requested due, return option, additional charged days/fee and payment state.
- Do not update dueAt optimistically before server returns APPLIED.

## Backend migration
- Build one Area A `TripRentalContextPort` that resolves membership for both Public and Private Trip.
- Recheck context on quote/create/payment and keep optimistic versioning.
- Extension transaction: validate -> hold all delta reservations -> create request -> payment -> apply order/return task.
- Late/duplicate payment must reconcile and must not apply an expired extension silently.

## Mock/OpenAPI
Do not patch only FE examples. Once route/DTO names are approved, bump contract version and regenerate OpenAPI + mock scenarios in one change.
