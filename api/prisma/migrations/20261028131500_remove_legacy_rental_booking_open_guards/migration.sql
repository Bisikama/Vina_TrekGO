-- Paid RentalOrders are terminal for checkout exclusivity. A Booking may own
-- more than one RentalOrder after each previous checkout has been paid.
--
-- These two legacy partial indexes still treated PAID (and later fulfillment
-- states) as an open order. They conflict with the newer guard
-- uq_rental_order_user_trip_open, which correctly protects only an unfinished
-- PENDING_PAYMENT checkout per user and trip.
DROP INDEX IF EXISTS "uq_rental_order_booking_open";
DROP INDEX IF EXISTS "uq_rental_orders_one_open_per_booking";
