-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'LEADER', 'STAFF_INVENTORY', 'STAFF_LOGISTICS', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "leader_type" AS ENUM ('EXPERT', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "test_result" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "certificate_status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "record_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "difficulty_level" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXTREME');

-- CreateEnum
CREATE TYPE "trail_access_source" AS ENUM ('PURCHASE', 'ADMIN_GRANT', 'PROMOTION');

-- CreateEnum
CREATE TYPE "trail_access_status" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'FAILED', 'REFUNDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "personal_trail_visibility" AS ENUM ('PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "trail_submission_status" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "trip_type" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "trip_status" AS ENUM ('DRAFT', 'OPEN', 'FULL', 'CLOSED', 'CANCEL_PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "cancellation_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "invite_status" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "trip_member_role" AS ENUM ('HOST', 'MEMBER');

-- CreateEnum
CREATE TYPE "trip_member_status" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('NOT_MARKED', 'PRESENT', 'ABSENT', 'LATE');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "participant_status" AS ENUM ('ACTIVE', 'CANCELLED', 'NO_SHOW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "checkin_status" AS ENUM ('NOT_CHECKED_IN', 'CHECKED_IN', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "checkin_method" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "trip_checkpoint_status" AS ENUM ('PENDING', 'REACHED', 'COMPLETED', 'SKIPPED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "mission_status" AS ENUM ('LOCKED', 'UNLOCKED', 'SUBMITTED', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "transport_source_type" AS ENUM ('SYSTEM_FLEET', 'THIRD_PARTY', 'SELF_ARRANGED');

-- CreateEnum
CREATE TYPE "vehicle_status" AS ENUM ('PLANNED', 'CONFIRMED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "rental_product_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "deposit_policy_type" AS ENUM ('FIXED', 'PERCENT_REPLACEMENT_VALUE');

-- CreateEnum
CREATE TYPE "equipment_unit_status" AS ENUM ('AVAILABLE', 'PICKED', 'PACKED', 'RENTED', 'RETURN_PENDING', 'CLEANING', 'MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "equipment_condition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "rental_quote_status" AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "rental_order_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY_FOR_HANDOVER', 'ACTIVE', 'RETURN_PENDING', 'RETURN_PROCESSING', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "rental_order_exception_status" AS ENUM ('NONE', 'ACTION_REQUIRED', 'OVERDUE', 'RETURN_INCOMPLETE');

-- CreateEnum
CREATE TYPE "rental_financial_status" AS ENUM ('UNPAID', 'PAYMENT_PENDING', 'PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'SETTLED');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "rental_unit_assignment_status" AS ENUM ('ASSIGNED', 'PACKED', 'HANDED_OVER', 'RETURNED', 'CLOSED', 'REPLACED', 'UNASSIGNED');

-- CreateEnum
CREATE TYPE "deposit_item_status" AS ENUM ('HELD', 'REFUND_PENDING', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'REFUND_FAILED', 'SETTLED');

-- CreateEnum
CREATE TYPE "package_status" AS ENUM ('OPEN', 'PACKED', 'READY', 'TRANSFERRED_TO_LOGISTICS', 'HANDED_OVER', 'RETURNING', 'RETURNED_TO_INVENTORY', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "inventory_task_status" AS ENUM ('OPEN', 'PICKING', 'CONDITION_CAPTURED', 'PACKED', 'READY', 'TRANSFERRED', 'RETURN_RECEIVED', 'CLOSED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "logistics_task_type" AS ENUM ('HANDOVER', 'RETURN');

-- CreateEnum
CREATE TYPE "logistics_task_status" AS ENUM ('SCHEDULED', 'PACKAGE_RECEIVED', 'RECIPIENT_VERIFIED', 'HANDED_OVER', 'COLLECTING', 'RETURNED', 'INVENTORY_RECEIVED', 'NO_SHOW', 'REFUSED', 'CLOSED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "snapshot_stage" AS ENUM ('PRE_HANDOVER', 'HANDOVER', 'RETURN_PRELIMINARY', 'RETURN_FINAL');

-- CreateEnum
CREATE TYPE "inspection_stage" AS ENUM ('PRELIMINARY', 'FINAL');

-- CreateEnum
CREATE TYPE "return_inspection_outcome" AS ENUM ('NORMAL', 'ISSUE', 'MISSING_PENDING_REVIEW', 'DAMAGE_CONFIRMED', 'LOST_CONFIRMED');

-- CreateEnum
CREATE TYPE "deposit_settlement_status" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'ACTION_REQUIRED', 'SETTLED');

-- CreateEnum
CREATE TYPE "deposit_settlement_outcome" AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'FULL_DEDUCTION');

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "custody_actor_type" AS ENUM ('INVENTORY_LOCATION', 'LOGISTICS', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "custody_event_type" AS ENUM ('INVENTORY_TO_LOGISTICS', 'LOGISTICS_TO_USER', 'USER_TO_LOGISTICS', 'LOGISTICS_TO_INVENTORY', 'INTERNAL_TRANSFER');

-- CreateEnum
CREATE TYPE "rental_exception_type" AS ENUM ('DAMAGE_DISPUTE', 'OVERDUE', 'RETURN_INCOMPLETE', 'PAYMENT_MISMATCH', 'REFUND_FAILURE', 'OTHER');

-- CreateEnum
CREATE TYPE "rental_exception_case_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "gps_session_status" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED');

-- CreateEnum
CREATE TYPE "deviation_status" AS ENUM ('DEVIATED', 'RECOVERED');

-- CreateEnum
CREATE TYPE "weather_risk_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'SEVERE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "invoice_type" AS ENUM ('BOOKING', 'TRAIL_ACCESS', 'RENTAL');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "refund_type" AS ENUM ('FULL', 'PARTIAL', 'DEPOSIT', 'BOOKING_CANCELLATION', 'RENTAL_CANCELLATION', 'TRAIL_ACCESS');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('PENDING', 'PUBLISHED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "avatar_url" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_profiles" (
    "user_id" UUID NOT NULL,
    "leader_type" "leader_type" NOT NULL,
    "verify_status" "verification_status" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "completed_trip_count" INTEGER NOT NULL DEFAULT 0,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "leader_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_type" "leader_type" NOT NULL,
    "status" "application_status" NOT NULL DEFAULT 'DRAFT',
    "motivation" TEXT,
    "experience_summary" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_tests" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "max_score" DECIMAL(8,2) NOT NULL,
    "passing_score" DECIMAL(8,2) NOT NULL,
    "duration_minutes" INTEGER,
    "max_attempts" INTEGER,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_test_attempts" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "application_id" UUID,
    "attempt_no" INTEGER NOT NULL,
    "test_version_snapshot" INTEGER NOT NULL,
    "passing_score_snapshot" DECIMAL(8,2) NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "max_score" DECIMAL(8,2) NOT NULL,
    "result" "test_result" NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_certificates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "application_id" UUID,
    "certificate_type" VARCHAR(100) NOT NULL,
    "certificate_number" VARCHAR(100),
    "issuer" VARCHAR(200),
    "file_url" TEXT NOT NULL,
    "issued_at" DATE,
    "expires_at" DATE,
    "status" "certificate_status" NOT NULL DEFAULT 'PENDING',
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "region" VARCHAR(150),
    "center_lat" DECIMAL(10,7),
    "center_lng" DECIMAL(10,7),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_points" (
    "id" UUID NOT NULL,
    "destination_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "note" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_trails" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "destination_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "difficulty" "difficulty_level",
    "distance_km" DECIMAL(8,2),
    "elevation_gain_m" INTEGER,
    "route_geojson" JSONB NOT NULL,
    "visibility" "personal_trail_visibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "personal_trails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trail_submissions" (
    "id" UUID NOT NULL,
    "personal_trail_id" UUID NOT NULL,
    "submitted_by" UUID NOT NULL,
    "status" "trail_submission_status" NOT NULL DEFAULT 'DRAFT',
    "submission_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trail_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_trails" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "source_submission_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "difficulty" "difficulty_level" NOT NULL,
    "distance_km" DECIMAL(8,2) NOT NULL,
    "elevation_gain_m" INTEGER,
    "estimated_duration_minutes" INTEGER,
    "route_geojson" JSONB NOT NULL,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "system_trails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trail_accesses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "system_trail_id" UUID NOT NULL,
    "source_type" "trail_access_source" NOT NULL DEFAULT 'PURCHASE',
    "price_snapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "trail_access_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "purchased_at" TIMESTAMPTZ(6),
    "activated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trail_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "default_radius_meters" INTEGER NOT NULL DEFAULT 50,
    "checkpoint_type" VARCHAR(50),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trail_checkpoints" (
    "id" UUID NOT NULL,
    "system_trail_id" UUID NOT NULL,
    "checkpoint_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trail_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_checkpoints" (
    "id" UUID NOT NULL,
    "personal_trail_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 50,
    "info" TEXT,
    "image_urls" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trail_recordings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200),
    "status" VARCHAR(30) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "processed_geojson" JSONB,
    "distance_km" DECIMAL(8,2),
    "elevation_gain_m" INTEGER,
    "created_personal_trail_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trail_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "trip_type" "trip_type" NOT NULL,
    "title" VARCHAR(220) NOT NULL,
    "description" TEXT,
    "destination_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "leader_id" UUID,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "min_pax" INTEGER NOT NULL DEFAULT 1,
    "max_pax" INTEGER NOT NULL,
    "price_per_pax" DECIMAL(12,2),
    "status" "trip_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_trail_plans" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "system_trail_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "snapshot_name" VARCHAR(200) NOT NULL,
    "snapshot_difficulty" "difficulty_level" NOT NULL,
    "snapshot_geojson" JSONB NOT NULL,
    "snapshot_distance_km" DECIMAL(8,2),
    "snapshot_elevation_gain_m" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_trail_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_active_trail_plans" (
    "trip_id" UUID NOT NULL,
    "trail_plan_id" UUID NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "trip_active_trail_plans_pkey" PRIMARY KEY ("trip_id")
);

-- CreateTable
CREATE TABLE "trip_trail_switches" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "from_plan_id" UUID,
    "to_plan_id" UUID NOT NULL,
    "reason" TEXT,
    "actor_id" UUID NOT NULL,
    "switched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_trail_switches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_checkpoints" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "source_checkpoint_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "radius_meters" INTEGER NOT NULL,
    "mission_title" VARCHAR(200),
    "mission_description" TEXT,
    "mission_type" VARCHAR(50),
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_checkpoint_progress" (
    "id" UUID NOT NULL,
    "trip_checkpoint_id" UUID NOT NULL,
    "status" "trip_checkpoint_status" NOT NULL DEFAULT 'PENDING',
    "reached_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "updated_by" UUID,
    "override_reason" TEXT,
    "override_evidence_urls" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_checkpoint_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_providers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(150),
    "phone" VARCHAR(30),
    "email" VARCHAR(320),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_transports" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "pickup_point_id" UUID NOT NULL,
    "return_point_id" UUID,
    "sequence" INTEGER NOT NULL,
    "source_type" "transport_source_type" NOT NULL DEFAULT 'SYSTEM_FLEET',
    "provider_id" UUID,
    "vehicle_type" VARCHAR(80) NOT NULL,
    "seat_capacity" INTEGER NOT NULL,
    "plate_number" VARCHAR(30),
    "driver_name" VARCHAR(150),
    "driver_phone" VARCHAR(30),
    "provider_name" VARCHAR(200),
    "meeting_at" TIMESTAMPTZ(6) NOT NULL,
    "departure_at" TIMESTAMPTZ(6),
    "return_at" TIMESTAMPTZ(6),
    "status" "vehicle_status" NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_transports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_cancellation_requests" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_urls" JSONB,
    "status" "cancellation_request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "review_note" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "trip_cancellation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_trip_invites" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "status" "invite_status" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "private_trip_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_members" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_by_invite_id" UUID,
    "pickup_point_id" UUID,
    "role" "trip_member_role" NOT NULL DEFAULT 'MEMBER',
    "status" "trip_member_status" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),
    "attendance_status" "attendance_status" NOT NULL DEFAULT 'NOT_MARKED',
    "attended_at" TIMESTAMPTZ(6),
    "attendance_marked_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_policies" (
    "id" UUID NOT NULL,
    "policy_code" VARCHAR(80) NOT NULL,
    "version_no" INTEGER NOT NULL,
    "hold_ttl_minutes" INTEGER NOT NULL,
    "cancellation_rules" JSONB NOT NULL,
    "no_show_rules" JSONB,
    "participant_rules" JSONB,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pickup_point_id" UUID NOT NULL,
    "return_point_id" UUID NOT NULL,
    "booking_policy_id" UUID NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "participant_count" INTEGER NOT NULL,
    "price_per_pax_snapshot" DECIMAL(12,2) NOT NULL,
    "subtotal_amount" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "insurance_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "policy_snapshot" JSONB NOT NULL,
    "confirmation_idempotency_key" VARCHAR(200),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_participants" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "date_of_birth" DATE,
    "id_document_no" VARCHAR(80),
    "emergency_contact_name" VARCHAR(150),
    "emergency_contact_phone" VARCHAR(30),
    "status" "participant_status" NOT NULL DEFAULT 'ACTIVE',
    "checkin_code" VARCHAR(160) NOT NULL,
    "checkin_status" "checkin_status" NOT NULL DEFAULT 'NOT_CHECKED_IN',
    "checkin_method" "checkin_method",
    "checked_in_at" TIMESTAMPTZ(6),
    "checked_in_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_cancellations" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "cancelled_by" UUID,
    "reason" TEXT,
    "policy_snapshot" JSONB NOT NULL,
    "refundable_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_outbox_events" (
    "id" UUID NOT NULL,
    "deduplication_key" VARCHAR(220) NOT NULL,
    "event_type" VARCHAR(140) NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "event_status" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "booking_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_locations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_products" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "daily_price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "replacement_value" DECIMAL(12,2) NOT NULL,
    "deposit_policy_type" "deposit_policy_type" NOT NULL DEFAULT 'FIXED',
    "deposit_value" DECIMAL(12,2) NOT NULL,
    "usage_group" VARCHAR(80),
    "images" JSONB,
    "specifications" JSONB,
    "recommendation_tags" JSONB,
    "required_accessories" JSONB,
    "requires_deep_return_inspection" BOOLEAN NOT NULL DEFAULT false,
    "status" "rental_product_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_units" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "home_inventory_location_id" UUID NOT NULL,
    "current_inventory_location_id" UUID,
    "asset_code" VARCHAR(100) NOT NULL,
    "qr_code" VARCHAR(180),
    "serial_number" VARCHAR(120),
    "status" "equipment_unit_status" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "equipment_condition" NOT NULL DEFAULT 'GOOD',
    "expected_ready_at" TIMESTAMPTZ(6),
    "acquired_at" DATE,
    "retired_at" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_policies" (
    "id" UUID NOT NULL,
    "policy_code" VARCHAR(80) NOT NULL,
    "version_no" INTEGER NOT NULL,
    "quote_ttl_minutes" INTEGER NOT NULL,
    "cutoff_hours_before_trip" INTEGER NOT NULL,
    "prep_buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "return_buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "cleaning_buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "quantity_rules" JSONB NOT NULL,
    "cancellation_rules" JSONB NOT NULL,
    "damage_deduction_rules" JSONB NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_product_price_history" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "daily_price" DECIMAL(12,2) NOT NULL,
    "replacement_value" DECIMAL(12,2) NOT NULL,
    "deposit_policy_type" "deposit_policy_type" NOT NULL,
    "deposit_value" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "changed_by" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_product_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_quotes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "recipient_participant_id" UUID,
    "recipient_snapshot" JSONB NOT NULL,
    "context_version" INTEGER NOT NULL,
    "rental_policy_id" UUID NOT NULL,
    "rental_start_at" TIMESTAMPTZ(6) NOT NULL,
    "rental_end_at" TIMESTAMPTZ(6) NOT NULL,
    "rental_fee" DECIMAL(12,2) NOT NULL,
    "total_deposit" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "policy_snapshot" JSONB NOT NULL,
    "status" "rental_quote_status" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_quote_lines" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "daily_price_snapshot" DECIMAL(12,2) NOT NULL,
    "deposit_per_unit_snapshot" DECIMAL(12,2) NOT NULL,
    "charged_days" INTEGER NOT NULL,
    "line_rental_fee" DECIMAL(12,2) NOT NULL,
    "line_deposit" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_orders" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "rental_policy_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "recipient_participant_id" UUID,
    "recipient_snapshot" JSONB NOT NULL,
    "pickup_point_id" UUID NOT NULL,
    "return_point_id" UUID NOT NULL,
    "context_version_snapshot" INTEGER NOT NULL,
    "rental_start_at" TIMESTAMPTZ(6) NOT NULL,
    "rental_end_at" TIMESTAMPTZ(6) NOT NULL,
    "occupied_start_at" TIMESTAMPTZ(6) NOT NULL,
    "occupied_end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "rental_order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "exception_status" "rental_order_exception_status" NOT NULL DEFAULT 'NONE',
    "financial_status" "rental_financial_status" NOT NULL DEFAULT 'UNPAID',
    "rental_fee" DECIMAL(12,2) NOT NULL,
    "total_deposit" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "policy_snapshot" JSONB NOT NULL,
    "payment_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_order_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "daily_price_snapshot" DECIMAL(12,2) NOT NULL,
    "deposit_per_unit_snapshot" DECIMAL(12,2) NOT NULL,
    "replacement_value_snapshot" DECIMAL(12,2) NOT NULL,
    "charged_days" INTEGER NOT NULL,
    "line_rental_fee" DECIMAL(12,2) NOT NULL,
    "line_deposit" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_quantity_reservations" (
    "id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "reservation_cycle" INTEGER NOT NULL DEFAULT 1,
    "quantity" INTEGER NOT NULL,
    "occupied_from" TIMESTAMPTZ(6) NOT NULL,
    "occupied_until" TIMESTAMPTZ(6) NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'HELD',
    "hold_expires_at" TIMESTAMPTZ(6),
    "reserved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_quantity_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_unit_assignments" (
    "id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "equipment_unit_id" UUID NOT NULL,
    "status" "rental_unit_assignment_status" NOT NULL DEFAULT 'ASSIGNED',
    "replaced_from_id" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packed_at" TIMESTAMPTZ(6),
    "handed_over_at" TIMESTAMPTZ(6),
    "returned_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_unit_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "package_code" VARCHAR(120) NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "package_status" NOT NULL DEFAULT 'OPEN',
    "sealed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_items" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "equipment_unit_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_tasks" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "inventory_location_id" UUID NOT NULL,
    "package_id" UUID,
    "staff_id" UUID,
    "status" "inventory_task_status" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_tasks" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "service_point_id" UUID NOT NULL,
    "staff_id" UUID,
    "task_type" "logistics_task_type" NOT NULL,
    "status" "logistics_task_status" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMPTZ(6),
    "package_received_at" TIMESTAMPTZ(6),
    "recipient_verified_at" TIMESTAMPTZ(6),
    "handover_at" TIMESTAMPTZ(6),
    "returned_at" TIMESTAMPTZ(6),
    "inventory_received_at" TIMESTAMPTZ(6),
    "no_show_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_pickup_codes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "verification_ref" VARCHAR(180),
    "package_version_snapshot" INTEGER,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_pickup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_handovers" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "logistics_task_id" UUID NOT NULL,
    "pickup_code_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "verification_ref" VARCHAR(180) NOT NULL,
    "recipient_snapshot" JSONB NOT NULL,
    "recipient_notes" TEXT,
    "reported_issues" JSONB,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "handed_over_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_snapshots" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "package_id" UUID,
    "snapshot_stage" "snapshot_stage" NOT NULL,
    "condition" "equipment_condition" NOT NULL,
    "notes" TEXT,
    "accessories" JSONB,
    "evidence_ids" JSONB,
    "taken_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condition_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_inspections" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "inspector_id" UUID NOT NULL,
    "stage" "inspection_stage" NOT NULL,
    "outcome" "return_inspection_outcome" NOT NULL,
    "received_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "evidence_ids" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_exception_cases" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "assignment_id" UUID,
    "unit_id" UUID,
    "inspection_id" UUID,
    "case_type" "rental_exception_type" NOT NULL,
    "status" "rental_exception_case_status" NOT NULL DEFAULT 'OPEN',
    "opened_by" UUID,
    "assigned_to" UUID,
    "reason" TEXT NOT NULL,
    "evidence_ids" JSONB,
    "resolution" TEXT,
    "approval_ref" VARCHAR(180),
    "due_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_exception_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_assessment_reviews" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exception_case_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_urls" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_assessment_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_settlements" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "rental_policy_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "total_deposit" DECIMAL(12,2) NOT NULL,
    "total_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "deposit_settlement_status" NOT NULL DEFAULT 'OPEN',
    "outcome" "deposit_settlement_outcome",
    "reason" TEXT,
    "policy_snapshot" JSONB NOT NULL,
    "settled_by" UUID,
    "settled_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_settlement_items" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "inspection_id" UUID,
    "deposit_amount" DECIMAL(12,2) NOT NULL,
    "deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "deposit_item_status" NOT NULL DEFAULT 'HELD',
    "outcome" "deposit_settlement_outcome",
    "reason" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "settled_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "inventory_location_id" UUID NOT NULL,
    "staff_id" UUID,
    "reason" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "maintenance_status" NOT NULL DEFAULT 'OPEN',
    "start_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "before_evidence_ids" JSONB,
    "after_evidence_ids" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_events" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "order_id" UUID NOT NULL,
    "package_id" UUID,
    "unit_id" UUID,
    "logistics_task_id" UUID,
    "event_type" "custody_event_type" NOT NULL,
    "from_actor_type" "custody_actor_type" NOT NULL,
    "from_user_id" UUID,
    "from_inventory_location_id" UUID,
    "to_actor_type" "custody_actor_type" NOT NULL,
    "to_user_id" UUID,
    "to_inventory_location_id" UUID,
    "order_status_before" "rental_order_status",
    "order_status_after" "rental_order_status",
    "package_status_before" "package_status",
    "package_status_after" "package_status",
    "unit_status_before" "equipment_unit_status",
    "unit_status_after" "equipment_unit_status",
    "logistics_status_before" "logistics_task_status",
    "logistics_status_after" "logistics_task_status",
    "performed_by" UUID NOT NULL,
    "evidence_ids" JSONB,
    "note" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_outbox_events" (
    "id" UUID NOT NULL,
    "deduplication_key" VARCHAR(220) NOT NULL,
    "event_type" VARCHAR(140) NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "event_status" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "rental_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_policies" (
    "id" UUID NOT NULL,
    "policy_code" VARCHAR(80) NOT NULL,
    "version_no" INTEGER NOT NULL,
    "max_accepted_accuracy_m" DECIMAL(8,2),
    "sync_interval_seconds" INTEGER NOT NULL,
    "deviation_threshold_m" DECIMAL(10,2) NOT NULL,
    "deviation_consecutive_samples" INTEGER NOT NULL,
    "default_checkpoint_radius_m" INTEGER NOT NULL,
    "raw_location_retention_days" INTEGER NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "gps_policy_id" UUID NOT NULL,
    "status" "gps_session_status" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "device_id" VARCHAR(180),
    "actual_path_geojson" JSONB,
    "total_distance_meters" DECIMAL(12,2),
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_locations" (
    "id" BIGSERIAL NOT NULL,
    "session_id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy_m" DECIMAL(7,2),
    "speed_mps" DECIMAL(7,2),
    "heading_deg" DECIMAL(6,2),
    "altitude_m" DECIMAL(8,2),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_deviation_events" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "status" "deviation_status" NOT NULL DEFAULT 'DEVIATED',
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "recovered_at" TIMESTAMPTZ(6),
    "max_deviation_distance_m" DECIMAL(10,2),
    "last_latitude" DECIMAL(10,7),
    "last_longitude" DECIMAL(10,7),
    "threshold_m_snapshot" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_deviation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoint_events" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(220) NOT NULL,
    "trip_id" UUID NOT NULL,
    "trip_checkpoint_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "role_at_event" "user_role" NOT NULL,
    "arrival_latitude" DECIMAL(10,7),
    "arrival_longitude" DECIMAL(10,7),
    "distance_to_checkpoint_m" DECIMAL(10,2),
    "arrival_at" TIMESTAMPTZ(6) NOT NULL,
    "mission_status" "mission_status" NOT NULL DEFAULT 'LOCKED',
    "mission_answer" TEXT,
    "evidence_urls" JSONB,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkpoint_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_actual_routes" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "source_session_id" UUID,
    "route_geojson" JSONB NOT NULL,
    "total_distance_meters" DECIMAL(12,2),
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_actual_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_snapshots" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "trip_checkpoint_id" UUID,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "temperature_c" DECIMAL(5,2),
    "humidity_percent" DECIMAL(5,2),
    "wind_speed_mps" DECIMAL(7,2),
    "rain_probability_percent" DECIMAL(5,2),
    "weather_condition" VARCHAR(120),
    "risk_level" "weather_risk_level" NOT NULL DEFAULT 'UNKNOWN',
    "risk_summary" TEXT,
    "observed_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_outbox_events" (
    "id" UUID NOT NULL,
    "deduplication_key" VARCHAR(220) NOT NULL,
    "event_type" VARCHAR(140) NOT NULL,
    "aggregate_type" VARCHAR(100) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "event_status" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "gps_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoice_no" VARCHAR(80) NOT NULL,
    "user_id" UUID NOT NULL,
    "invoice_type" "invoice_type" NOT NULL,
    "booking_id" UUID,
    "rental_order_id" UUID,
    "trail_access_id" UUID,
    "subtotal_amount" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "expires_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_code" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(12,2) NOT NULL,
    "line_amount" DECIMAL(12,2) NOT NULL,
    "reference_type" VARCHAR(80),
    "reference_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "transaction_ref" VARCHAR(180),
    "payment_gateway" VARCHAR(80) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(200) NOT NULL,
    "gateway_payload" JSONB,
    "paid_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "payment_gateway" VARCHAR(80) NOT NULL,
    "provider_event_id" VARCHAR(220) NOT NULL,
    "payment_id" UUID,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "refund_type" "refund_type" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "reason" TEXT,
    "status" "refund_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(200) NOT NULL,
    "refund_transaction_ref" VARCHAR(180),
    "deposit_settlement_id" UUID,
    "deposit_settlement_item_id" UUID,
    "booking_cancellation_id" UUID,
    "rental_order_id" UUID,
    "trail_access_id" UUID,
    "provider_payload" JSONB,
    "refunded_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranks" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "min_points" INTEGER NOT NULL,
    "max_points" INTEGER,
    "description" TEXT,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ranks" (
    "user_id" UUID NOT NULL,
    "rank_id" UUID NOT NULL,
    "current_points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ranks_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "transaction_type" VARCHAR(80) NOT NULL,
    "reference_type" VARCHAR(80),
    "reference_id" UUID,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "icon_url" TEXT,
    "required_condition" JSONB,
    "status" "record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "trip_id" UUID,
    "unlocked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id","badge_id")
);

-- CreateTable
CREATE TABLE "trip_reviews" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "member_id" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_reviews" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "leader_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_reviews" (
    "id" UUID NOT NULL,
    "rental_order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "verified_usage" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" UUID NOT NULL,
    "config_key" VARCHAR(160) NOT NULL,
    "group_name" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "value_type" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(220) NOT NULL,
    "content" TEXT NOT NULL,
    "notification_type" VARCHAR(100) NOT NULL,
    "reference_type" VARCHAR(80),
    "reference_id" UUID,
    "status" "notification_status" NOT NULL DEFAULT 'UNREAD',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "request_id" VARCHAR(120),
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "leader_applications_user_id_status_idx" ON "leader_applications"("user_id", "status");

-- CreateIndex
CREATE INDEX "leader_applications_status_submitted_at_idx" ON "leader_applications"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "leader_tests_code_key" ON "leader_tests"("code");

-- CreateIndex
CREATE INDEX "leader_tests_status_code_idx" ON "leader_tests"("status", "code");

-- CreateIndex
CREATE INDEX "leader_test_attempts_user_id_completed_at_idx" ON "leader_test_attempts"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "leader_test_attempts_application_id_completed_at_idx" ON "leader_test_attempts"("application_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "leader_test_attempts_user_id_test_id_attempt_no_key" ON "leader_test_attempts"("user_id", "test_id", "attempt_no");

-- CreateIndex
CREATE INDEX "leader_certificates_user_id_status_idx" ON "leader_certificates"("user_id", "status");

-- CreateIndex
CREATE INDEX "leader_certificates_expires_at_idx" ON "leader_certificates"("expires_at");

-- CreateIndex
CREATE INDEX "destinations_name_idx" ON "destinations"("name");

-- CreateIndex
CREATE INDEX "destinations_region_status_idx" ON "destinations"("region", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_points_code_key" ON "pickup_points"("code");

-- CreateIndex
CREATE INDEX "pickup_points_destination_id_status_idx" ON "pickup_points"("destination_id", "status");

-- CreateIndex
CREATE INDEX "pickup_points_name_idx" ON "pickup_points"("name");

-- CreateIndex
CREATE INDEX "personal_trails_user_id_status_idx" ON "personal_trails"("user_id", "status");

-- CreateIndex
CREATE INDEX "personal_trails_destination_id_status_idx" ON "personal_trails"("destination_id", "status");

-- CreateIndex
CREATE INDEX "trail_submissions_personal_trail_id_status_idx" ON "trail_submissions"("personal_trail_id", "status");

-- CreateIndex
CREATE INDEX "trail_submissions_status_created_at_idx" ON "trail_submissions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_trails_code_key" ON "system_trails"("code");

-- CreateIndex
CREATE INDEX "system_trails_destination_id_difficulty_status_idx" ON "system_trails"("destination_id", "difficulty", "status");

-- CreateIndex
CREATE INDEX "system_trails_name_idx" ON "system_trails"("name");

-- CreateIndex
CREATE INDEX "trail_accesses_user_id_status_idx" ON "trail_accesses"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trail_accesses_user_id_system_trail_id_key" ON "trail_accesses"("user_id", "system_trail_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoints_code_key" ON "checkpoints"("code");

-- CreateIndex
CREATE INDEX "checkpoints_destination_id_status_idx" ON "checkpoints"("destination_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trail_checkpoints_system_trail_id_sequence_key" ON "trail_checkpoints"("system_trail_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "trail_checkpoints_system_trail_id_checkpoint_id_key" ON "trail_checkpoints"("system_trail_id", "checkpoint_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_checkpoints_personal_trail_id_sequence_key" ON "personal_checkpoints"("personal_trail_id", "sequence");

-- CreateIndex
CREATE INDEX "trail_recordings_user_id_started_at_idx" ON "trail_recordings"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "trail_recordings_status_idx" ON "trail_recordings"("status");

-- CreateIndex
CREATE INDEX "trips_trip_type_status_start_at_idx" ON "trips"("trip_type", "status", "start_at");

-- CreateIndex
CREATE INDEX "trips_destination_id_start_at_idx" ON "trips"("destination_id", "start_at");

-- CreateIndex
CREATE INDEX "trips_leader_id_start_at_end_at_idx" ON "trips"("leader_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "trips_creator_id_start_at_idx" ON "trips"("creator_id", "start_at");

-- CreateIndex
CREATE INDEX "trip_trail_plans_trip_id_system_trail_id_idx" ON "trip_trail_plans"("trip_id", "system_trail_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_trail_plans_trip_id_sequence_key" ON "trip_trail_plans"("trip_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "trip_trail_plans_trip_id_id_key" ON "trip_trail_plans"("trip_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_trip_active_trail_plan_trip_plan" ON "trip_active_trail_plans"("trip_id", "trail_plan_id");

-- CreateIndex
CREATE INDEX "trip_trail_switches_trip_id_switched_at_idx" ON "trip_trail_switches"("trip_id", "switched_at");

-- CreateIndex
CREATE INDEX "trip_checkpoints_trip_id_is_required_idx" ON "trip_checkpoints"("trip_id", "is_required");

-- CreateIndex
CREATE UNIQUE INDEX "trip_checkpoints_trip_id_sequence_key" ON "trip_checkpoints"("trip_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "trip_checkpoint_progress_trip_checkpoint_id_key" ON "trip_checkpoint_progress"("trip_checkpoint_id");

-- CreateIndex
CREATE INDEX "transport_providers_name_status_idx" ON "transport_providers"("name", "status");

-- CreateIndex
CREATE INDEX "trip_transports_trip_id_pickup_point_id_status_idx" ON "trip_transports"("trip_id", "pickup_point_id", "status");

-- CreateIndex
CREATE INDEX "trip_transports_plate_number_idx" ON "trip_transports"("plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "trip_transports_trip_id_sequence_key" ON "trip_transports"("trip_id", "sequence");

-- CreateIndex
CREATE INDEX "trip_cancellation_requests_trip_id_status_idx" ON "trip_cancellation_requests"("trip_id", "status");

-- CreateIndex
CREATE INDEX "trip_cancellation_requests_status_requested_at_idx" ON "trip_cancellation_requests"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "private_trip_invites_code_key" ON "private_trip_invites"("code");

-- CreateIndex
CREATE INDEX "private_trip_invites_trip_id_status_idx" ON "private_trip_invites"("trip_id", "status");

-- CreateIndex
CREATE INDEX "private_trip_invites_expires_at_idx" ON "private_trip_invites"("expires_at");

-- CreateIndex
CREATE INDEX "trip_members_user_id_status_idx" ON "trip_members"("user_id", "status");

-- CreateIndex
CREATE INDEX "trip_members_trip_id_status_idx" ON "trip_members"("trip_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trip_members_trip_id_user_id_key" ON "trip_members"("trip_id", "user_id");

-- CreateIndex
CREATE INDEX "booking_policies_is_active_effective_from_idx" ON "booking_policies"("is_active", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "booking_policies_policy_code_version_no_key" ON "booking_policies"("policy_code", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_confirmation_idempotency_key_key" ON "bookings"("confirmation_idempotency_key");

-- CreateIndex
CREATE INDEX "bookings_trip_id_status_idx" ON "bookings"("trip_id", "status");

-- CreateIndex
CREATE INDEX "bookings_user_id_status_idx" ON "bookings"("user_id", "status");

-- CreateIndex
CREATE INDEX "bookings_trip_id_user_id_idx" ON "bookings"("trip_id", "user_id");

-- CreateIndex
CREATE INDEX "bookings_booking_policy_id_idx" ON "bookings"("booking_policy_id");

-- CreateIndex
CREATE INDEX "bookings_pickup_point_id_idx" ON "bookings"("pickup_point_id");

-- CreateIndex
CREATE INDEX "bookings_return_point_id_idx" ON "bookings"("return_point_id");

-- CreateIndex
CREATE INDEX "bookings_expires_at_idx" ON "bookings"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_participants_checkin_code_key" ON "booking_participants"("checkin_code");

-- CreateIndex
CREATE INDEX "booking_participants_booking_id_status_idx" ON "booking_participants"("booking_id", "status");

-- CreateIndex
CREATE INDEX "booking_participants_user_id_status_idx" ON "booking_participants"("user_id", "status");

-- CreateIndex
CREATE INDEX "booking_cancellations_booking_id_cancelled_at_idx" ON "booking_cancellations"("booking_id", "cancelled_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_outbox_events_deduplication_key_key" ON "booking_outbox_events"("deduplication_key");

-- CreateIndex
CREATE INDEX "booking_outbox_events_status_created_at_idx" ON "booking_outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "booking_outbox_events_aggregate_type_aggregate_id_created_a_idx" ON "booking_outbox_events"("aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_outbox_events_event_type_idx" ON "booking_outbox_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_code_key" ON "inventory_locations"("code");

-- CreateIndex
CREATE INDEX "inventory_locations_status_idx" ON "inventory_locations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rental_categories_slug_key" ON "rental_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rental_products_sku_key" ON "rental_products"("sku");

-- CreateIndex
CREATE INDEX "rental_products_category_id_status_idx" ON "rental_products"("category_id", "status");

-- CreateIndex
CREATE INDEX "rental_products_name_idx" ON "rental_products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_units_asset_code_key" ON "equipment_units"("asset_code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_units_qr_code_key" ON "equipment_units"("qr_code");

-- CreateIndex
CREATE INDEX "equipment_units_product_id_status_condition_idx" ON "equipment_units"("product_id", "status", "condition");

-- CreateIndex
CREATE INDEX "equipment_units_current_inventory_location_id_status_idx" ON "equipment_units"("current_inventory_location_id", "status");

-- CreateIndex
CREATE INDEX "equipment_units_status_expected_ready_at_idx" ON "equipment_units"("status", "expected_ready_at");

-- CreateIndex
CREATE INDEX "rental_policies_is_active_effective_from_idx" ON "rental_policies"("is_active", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "rental_policies_policy_code_version_no_key" ON "rental_policies"("policy_code", "version_no");

-- CreateIndex
CREATE INDEX "rental_product_price_history_product_id_effective_from_idx" ON "rental_product_price_history"("product_id", "effective_from");

-- CreateIndex
CREATE INDEX "rental_quotes_user_id_status_idx" ON "rental_quotes"("user_id", "status");

-- CreateIndex
CREATE INDEX "rental_quotes_trip_id_status_idx" ON "rental_quotes"("trip_id", "status");

-- CreateIndex
CREATE INDEX "rental_quotes_booking_id_status_idx" ON "rental_quotes"("booking_id", "status");

-- CreateIndex
CREATE INDEX "rental_quotes_rental_policy_id_idx" ON "rental_quotes"("rental_policy_id");

-- CreateIndex
CREATE INDEX "rental_quotes_expires_at_idx" ON "rental_quotes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_quote_lines_quote_id_product_id_key" ON "rental_quote_lines"("quote_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_orders_quote_id_key" ON "rental_orders"("quote_id");

-- CreateIndex
CREATE INDEX "rental_orders_user_id_status_idx" ON "rental_orders"("user_id", "status");

-- CreateIndex
CREATE INDEX "rental_orders_trip_id_status_idx" ON "rental_orders"("trip_id", "status");

-- CreateIndex
CREATE INDEX "rental_orders_rental_policy_id_idx" ON "rental_orders"("rental_policy_id");

-- CreateIndex
CREATE INDEX "rental_orders_booking_id_status_idx" ON "rental_orders"("booking_id", "status");

-- CreateIndex
CREATE INDEX "rental_orders_pickup_point_id_idx" ON "rental_orders"("pickup_point_id");

-- CreateIndex
CREATE INDEX "rental_orders_return_point_id_idx" ON "rental_orders"("return_point_id");

-- CreateIndex
CREATE INDEX "rental_orders_payment_expires_at_idx" ON "rental_orders"("payment_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_order_lines_order_id_product_id_key" ON "rental_order_lines"("order_id", "product_id");

-- CreateIndex
CREATE INDEX "rental_quantity_reservations_product_id_status_occupied_fro_idx" ON "rental_quantity_reservations"("product_id", "status", "occupied_from", "occupied_until");

-- CreateIndex
CREATE INDEX "rental_quantity_reservations_order_line_id_status_idx" ON "rental_quantity_reservations"("order_line_id", "status");

-- CreateIndex
CREATE INDEX "rental_quantity_reservations_hold_expires_at_idx" ON "rental_quantity_reservations"("hold_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_quantity_reservations_order_line_id_reservation_cycl_key" ON "rental_quantity_reservations"("order_line_id", "reservation_cycle");

-- CreateIndex
CREATE INDEX "rental_unit_assignments_order_line_id_status_idx" ON "rental_unit_assignments"("order_line_id", "status");

-- CreateIndex
CREATE INDEX "rental_unit_assignments_equipment_unit_id_status_idx" ON "rental_unit_assignments"("equipment_unit_id", "status");

-- CreateIndex
CREATE INDEX "rental_unit_assignments_replaced_from_id_idx" ON "rental_unit_assignments"("replaced_from_id");

-- CreateIndex
CREATE UNIQUE INDEX "packages_package_code_key" ON "packages"("package_code");

-- CreateIndex
CREATE UNIQUE INDEX "packages_order_id_key" ON "packages"("order_id");

-- CreateIndex
CREATE INDEX "packages_status_idx" ON "packages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "package_items_assignment_id_key" ON "package_items"("assignment_id");

-- CreateIndex
CREATE INDEX "package_items_equipment_unit_id_idx" ON "package_items"("equipment_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_items_package_id_equipment_unit_id_key" ON "package_items"("package_id", "equipment_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_tasks_order_id_key" ON "inventory_tasks"("order_id");

-- CreateIndex
CREATE INDEX "inventory_tasks_inventory_location_id_status_deadline_idx" ON "inventory_tasks"("inventory_location_id", "status", "deadline");

-- CreateIndex
CREATE INDEX "inventory_tasks_staff_id_status_idx" ON "inventory_tasks"("staff_id", "status");

-- CreateIndex
CREATE INDEX "logistics_tasks_staff_id_status_scheduled_at_idx" ON "logistics_tasks"("staff_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "logistics_tasks_trip_id_task_type_status_idx" ON "logistics_tasks"("trip_id", "task_type", "status");

-- CreateIndex
CREATE INDEX "logistics_tasks_service_point_id_task_type_status_idx" ON "logistics_tasks"("service_point_id", "task_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_tasks_order_id_task_type_key" ON "logistics_tasks"("order_id", "task_type");

-- CreateIndex
CREATE UNIQUE INDEX "rental_pickup_codes_code_hash_key" ON "rental_pickup_codes"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "rental_pickup_codes_verification_ref_key" ON "rental_pickup_codes"("verification_ref");

-- CreateIndex
CREATE INDEX "rental_pickup_codes_order_id_expires_at_idx" ON "rental_pickup_codes"("order_id", "expires_at");

-- CreateIndex
CREATE INDEX "rental_pickup_codes_verified_by_verified_at_idx" ON "rental_pickup_codes"("verified_by", "verified_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_handovers_order_id_key" ON "rental_handovers"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_handovers_package_id_key" ON "rental_handovers"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_handovers_logistics_task_id_key" ON "rental_handovers"("logistics_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_handovers_pickup_code_id_key" ON "rental_handovers"("pickup_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "rental_handovers_verification_ref_key" ON "rental_handovers"("verification_ref");

-- CreateIndex
CREATE UNIQUE INDEX "rental_handovers_idempotency_key_key" ON "rental_handovers"("idempotency_key");

-- CreateIndex
CREATE INDEX "rental_handovers_staff_id_handed_over_at_idx" ON "rental_handovers"("staff_id", "handed_over_at");

-- CreateIndex
CREATE INDEX "condition_snapshots_unit_id_created_at_idx" ON "condition_snapshots"("unit_id", "created_at");

-- CreateIndex
CREATE INDEX "condition_snapshots_order_id_snapshot_stage_idx" ON "condition_snapshots"("order_id", "snapshot_stage");

-- CreateIndex
CREATE UNIQUE INDEX "condition_snapshots_assignment_id_snapshot_stage_key" ON "condition_snapshots"("assignment_id", "snapshot_stage");

-- CreateIndex
CREATE INDEX "return_inspections_order_id_stage_idx" ON "return_inspections"("order_id", "stage");

-- CreateIndex
CREATE INDEX "return_inspections_unit_id_created_at_idx" ON "return_inspections"("unit_id", "created_at");

-- CreateIndex
CREATE INDEX "return_inspections_outcome_idx" ON "return_inspections"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "return_inspections_assignment_id_stage_key" ON "return_inspections"("assignment_id", "stage");

-- CreateIndex
CREATE INDEX "rental_exception_cases_order_id_status_idx" ON "rental_exception_cases"("order_id", "status");

-- CreateIndex
CREATE INDEX "rental_exception_cases_assignment_id_status_idx" ON "rental_exception_cases"("assignment_id", "status");

-- CreateIndex
CREATE INDEX "rental_exception_cases_unit_id_status_idx" ON "rental_exception_cases"("unit_id", "status");

-- CreateIndex
CREATE INDEX "rental_exception_cases_case_type_status_idx" ON "rental_exception_cases"("case_type", "status");

-- CreateIndex
CREATE INDEX "rental_exception_cases_assigned_to_status_idx" ON "rental_exception_cases"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "rental_assessment_reviews_order_id_created_at_idx" ON "rental_assessment_reviews"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_assessment_reviews_inspection_id_user_id_key" ON "rental_assessment_reviews"("inspection_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_settlements_order_id_key" ON "deposit_settlements"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_settlements_idempotency_key_key" ON "deposit_settlements"("idempotency_key");

-- CreateIndex
CREATE INDEX "deposit_settlements_status_idx" ON "deposit_settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_settlement_items_assignment_id_key" ON "deposit_settlement_items"("assignment_id");

-- CreateIndex
CREATE INDEX "deposit_settlement_items_status_idx" ON "deposit_settlement_items"("status");

-- CreateIndex
CREATE INDEX "deposit_settlement_items_approved_by_status_idx" ON "deposit_settlement_items"("approved_by", "status");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_settlement_items_settlement_id_unit_id_key" ON "deposit_settlement_items"("settlement_id", "unit_id");

-- CreateIndex
CREATE INDEX "maintenance_records_unit_id_status_idx" ON "maintenance_records"("unit_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_records_inventory_location_id_status_idx" ON "maintenance_records"("inventory_location_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_records_staff_id_status_idx" ON "maintenance_records"("staff_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "custody_events_idempotency_key_key" ON "custody_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "custody_events_order_id_occurred_at_idx" ON "custody_events"("order_id", "occurred_at");

-- CreateIndex
CREATE INDEX "custody_events_package_id_occurred_at_idx" ON "custody_events"("package_id", "occurred_at");

-- CreateIndex
CREATE INDEX "custody_events_unit_id_occurred_at_idx" ON "custody_events"("unit_id", "occurred_at");

-- CreateIndex
CREATE INDEX "custody_events_logistics_task_id_occurred_at_idx" ON "custody_events"("logistics_task_id", "occurred_at");

-- CreateIndex
CREATE INDEX "custody_events_from_inventory_location_id_occurred_at_idx" ON "custody_events"("from_inventory_location_id", "occurred_at");

-- CreateIndex
CREATE INDEX "custody_events_to_inventory_location_id_occurred_at_idx" ON "custody_events"("to_inventory_location_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_outbox_events_deduplication_key_key" ON "rental_outbox_events"("deduplication_key");

-- CreateIndex
CREATE INDEX "rental_outbox_events_status_created_at_idx" ON "rental_outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "rental_outbox_events_aggregate_type_aggregate_id_created_at_idx" ON "rental_outbox_events"("aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE INDEX "rental_outbox_events_event_type_idx" ON "rental_outbox_events"("event_type");

-- CreateIndex
CREATE INDEX "gps_policies_is_active_effective_from_idx" ON "gps_policies"("is_active", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "gps_policies_policy_code_version_no_key" ON "gps_policies"("policy_code", "version_no");

-- CreateIndex
CREATE INDEX "gps_sessions_user_id_trip_id_idx" ON "gps_sessions"("user_id", "trip_id");

-- CreateIndex
CREATE INDEX "gps_sessions_trip_id_status_idx" ON "gps_sessions"("trip_id", "status");

-- CreateIndex
CREATE INDEX "gps_sessions_gps_policy_id_idx" ON "gps_sessions"("gps_policy_id");

-- CreateIndex
CREATE INDEX "gps_locations_session_id_recorded_at_idx" ON "gps_locations"("session_id", "recorded_at");

-- CreateIndex
CREATE INDEX "gps_locations_recorded_at_idx" ON "gps_locations"("recorded_at");

-- CreateIndex
CREATE INDEX "route_deviation_events_trip_id_status_start_at_idx" ON "route_deviation_events"("trip_id", "status", "start_at");

-- CreateIndex
CREATE INDEX "route_deviation_events_user_id_start_at_idx" ON "route_deviation_events"("user_id", "start_at");

-- CreateIndex
CREATE INDEX "route_deviation_events_session_id_start_at_idx" ON "route_deviation_events"("session_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoint_events_idempotency_key_key" ON "checkpoint_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "checkpoint_events_trip_id_trip_checkpoint_id_user_id_idx" ON "checkpoint_events"("trip_id", "trip_checkpoint_id", "user_id");

-- CreateIndex
CREATE INDEX "checkpoint_events_user_id_arrival_at_idx" ON "checkpoint_events"("user_id", "arrival_at");

-- CreateIndex
CREATE UNIQUE INDEX "trip_actual_routes_trip_id_key" ON "trip_actual_routes"("trip_id");

-- CreateIndex
CREATE INDEX "weather_snapshots_trip_id_observed_at_idx" ON "weather_snapshots"("trip_id", "observed_at");

-- CreateIndex
CREATE INDEX "weather_snapshots_trip_checkpoint_id_observed_at_idx" ON "weather_snapshots"("trip_checkpoint_id", "observed_at");

-- CreateIndex
CREATE UNIQUE INDEX "gps_outbox_events_deduplication_key_key" ON "gps_outbox_events"("deduplication_key");

-- CreateIndex
CREATE INDEX "gps_outbox_events_status_created_at_idx" ON "gps_outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "gps_outbox_events_aggregate_type_aggregate_id_created_at_idx" ON "gps_outbox_events"("aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE INDEX "gps_outbox_events_event_type_idx" ON "gps_outbox_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE INDEX "invoices_user_id_status_idx" ON "invoices"("user_id", "status");

-- CreateIndex
CREATE INDEX "invoices_invoice_type_status_idx" ON "invoices"("invoice_type", "status");

-- CreateIndex
CREATE INDEX "invoices_booking_id_idx" ON "invoices"("booking_id");

-- CreateIndex
CREATE INDEX "invoices_rental_order_id_idx" ON "invoices"("rental_order_id");

-- CreateIndex
CREATE INDEX "invoices_trail_access_id_idx" ON "invoices"("trail_access_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_line_code_idx" ON "invoice_lines"("invoice_id", "line_code");

-- CreateIndex
CREATE INDEX "invoice_lines_reference_type_reference_id_idx" ON "invoice_lines"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_invoice_id_status_idx" ON "payments"("invoice_id", "status");

-- CreateIndex
CREATE INDEX "payments_transaction_ref_idx" ON "payments"("transaction_ref");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processed_received_at_idx" ON "payment_webhook_events"("processed", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_payment_gateway_provider_event_id_key" ON "payment_webhook_events"("payment_gateway", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_deposit_settlement_item_id_key" ON "refunds"("deposit_settlement_item_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_status_idx" ON "refunds"("payment_id", "status");

-- CreateIndex
CREATE INDEX "refunds_refund_transaction_ref_idx" ON "refunds"("refund_transaction_ref");

-- CreateIndex
CREATE INDEX "refunds_deposit_settlement_id_idx" ON "refunds"("deposit_settlement_id");

-- CreateIndex
CREATE INDEX "refunds_booking_cancellation_id_idx" ON "refunds"("booking_cancellation_id");

-- CreateIndex
CREATE INDEX "refunds_rental_order_id_idx" ON "refunds"("rental_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranks_code_key" ON "ranks"("code");

-- CreateIndex
CREATE INDEX "point_transactions_user_id_created_at_idx" ON "point_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "point_transactions_reference_type_reference_id_idx" ON "point_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_code_key" ON "badges"("code");

-- CreateIndex
CREATE INDEX "user_badges_user_id_unlocked_at_idx" ON "user_badges"("user_id", "unlocked_at");

-- CreateIndex
CREATE INDEX "trip_reviews_trip_id_rating_idx" ON "trip_reviews"("trip_id", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "trip_reviews_trip_id_user_id_key" ON "trip_reviews"("trip_id", "user_id");

-- CreateIndex
CREATE INDEX "leader_reviews_leader_id_rating_idx" ON "leader_reviews"("leader_id", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "leader_reviews_trip_id_leader_id_user_id_key" ON "leader_reviews"("trip_id", "leader_id", "user_id");

-- CreateIndex
CREATE INDEX "rental_reviews_product_id_rating_idx" ON "rental_reviews"("product_id", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "rental_reviews_rental_order_id_product_id_user_id_key" ON "rental_reviews"("rental_order_id", "product_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_config_key_key" ON "system_configs"("config_key");

-- CreateIndex
CREATE INDEX "system_configs_group_name_is_active_idx" ON "system_configs"("group_name", "is_active");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_created_at_idx" ON "notifications"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_reference_type_reference_id_idx" ON "notifications"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- AddForeignKey
ALTER TABLE "leader_profiles" ADD CONSTRAINT "leader_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_profiles" ADD CONSTRAINT "leader_profiles_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_applications" ADD CONSTRAINT "leader_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_applications" ADD CONSTRAINT "leader_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_tests" ADD CONSTRAINT "leader_tests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_test_attempts" ADD CONSTRAINT "leader_test_attempts_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "leader_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_test_attempts" ADD CONSTRAINT "leader_test_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_test_attempts" ADD CONSTRAINT "leader_test_attempts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "leader_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_certificates" ADD CONSTRAINT "leader_certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_certificates" ADD CONSTRAINT "leader_certificates_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "leader_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_certificates" ADD CONSTRAINT "leader_certificates_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_points" ADD CONSTRAINT "pickup_points_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_points" ADD CONSTRAINT "pickup_points_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_trails" ADD CONSTRAINT "personal_trails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_trails" ADD CONSTRAINT "personal_trails_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_submissions" ADD CONSTRAINT "trail_submissions_personal_trail_id_fkey" FOREIGN KEY ("personal_trail_id") REFERENCES "personal_trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_submissions" ADD CONSTRAINT "trail_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_submissions" ADD CONSTRAINT "trail_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_trails" ADD CONSTRAINT "system_trails_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_trails" ADD CONSTRAINT "system_trails_source_submission_id_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "trail_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_trails" ADD CONSTRAINT "system_trails_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_accesses" ADD CONSTRAINT "trail_accesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_accesses" ADD CONSTRAINT "trail_accesses_system_trail_id_fkey" FOREIGN KEY ("system_trail_id") REFERENCES "system_trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_checkpoints" ADD CONSTRAINT "trail_checkpoints_system_trail_id_fkey" FOREIGN KEY ("system_trail_id") REFERENCES "system_trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_checkpoints" ADD CONSTRAINT "trail_checkpoints_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_checkpoints" ADD CONSTRAINT "personal_checkpoints_personal_trail_id_fkey" FOREIGN KEY ("personal_trail_id") REFERENCES "personal_trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_recordings" ADD CONSTRAINT "trail_recordings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_recordings" ADD CONSTRAINT "trail_recordings_created_personal_trail_id_fkey" FOREIGN KEY ("created_personal_trail_id") REFERENCES "personal_trails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_trail_plans" ADD CONSTRAINT "trip_trail_plans_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_trail_plans" ADD CONSTRAINT "trip_trail_plans_system_trail_id_fkey" FOREIGN KEY ("system_trail_id") REFERENCES "system_trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_active_trail_plans" ADD CONSTRAINT "trip_active_trail_plans_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_active_trail_plans" ADD CONSTRAINT "trip_active_trail_plans_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_active_trail_plans" ADD CONSTRAINT "trip_active_trail_plans_trip_id_trail_plan_id_fkey" FOREIGN KEY ("trip_id", "trail_plan_id") REFERENCES "trip_trail_plans"("trip_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_trail_switches" ADD CONSTRAINT "trip_trail_switches_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_trail_switches" ADD CONSTRAINT "trip_trail_switches_from_plan_id_fkey" FOREIGN KEY ("from_plan_id") REFERENCES "trip_trail_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_trail_switches" ADD CONSTRAINT "trip_trail_switches_to_plan_id_fkey" FOREIGN KEY ("to_plan_id") REFERENCES "trip_trail_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_trail_switches" ADD CONSTRAINT "trip_trail_switches_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_checkpoints" ADD CONSTRAINT "trip_checkpoints_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_checkpoints" ADD CONSTRAINT "trip_checkpoints_source_checkpoint_id_fkey" FOREIGN KEY ("source_checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_checkpoint_progress" ADD CONSTRAINT "trip_checkpoint_progress_trip_checkpoint_id_fkey" FOREIGN KEY ("trip_checkpoint_id") REFERENCES "trip_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_checkpoint_progress" ADD CONSTRAINT "trip_checkpoint_progress_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_transports" ADD CONSTRAINT "trip_transports_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_transports" ADD CONSTRAINT "trip_transports_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "pickup_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_transports" ADD CONSTRAINT "trip_transports_return_point_id_fkey" FOREIGN KEY ("return_point_id") REFERENCES "pickup_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_transports" ADD CONSTRAINT "trip_transports_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "transport_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_cancellation_requests" ADD CONSTRAINT "trip_cancellation_requests_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_cancellation_requests" ADD CONSTRAINT "trip_cancellation_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_cancellation_requests" ADD CONSTRAINT "trip_cancellation_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_trip_invites" ADD CONSTRAINT "private_trip_invites_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_trip_invites" ADD CONSTRAINT "private_trip_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_joined_by_invite_id_fkey" FOREIGN KEY ("joined_by_invite_id") REFERENCES "private_trip_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "pickup_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_attendance_marked_by_fkey" FOREIGN KEY ("attendance_marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_policies" ADD CONSTRAINT "booking_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "pickup_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_return_point_id_fkey" FOREIGN KEY ("return_point_id") REFERENCES "pickup_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_policy_id_fkey" FOREIGN KEY ("booking_policy_id") REFERENCES "booking_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cancellations" ADD CONSTRAINT "booking_cancellations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cancellations" ADD CONSTRAINT "booking_cancellations_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_products" ADD CONSTRAINT "rental_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "rental_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_home_inventory_location_id_fkey" FOREIGN KEY ("home_inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_current_inventory_location_id_fkey" FOREIGN KEY ("current_inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_policies" ADD CONSTRAINT "rental_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_product_price_history" ADD CONSTRAINT "rental_product_price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_product_price_history" ADD CONSTRAINT "rental_product_price_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_recipient_participant_id_fkey" FOREIGN KEY ("recipient_participant_id") REFERENCES "booking_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_rental_policy_id_fkey" FOREIGN KEY ("rental_policy_id") REFERENCES "rental_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quote_lines" ADD CONSTRAINT "rental_quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "rental_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quote_lines" ADD CONSTRAINT "rental_quote_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "rental_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_rental_policy_id_fkey" FOREIGN KEY ("rental_policy_id") REFERENCES "rental_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_recipient_participant_id_fkey" FOREIGN KEY ("recipient_participant_id") REFERENCES "booking_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "pickup_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_return_point_id_fkey" FOREIGN KEY ("return_point_id") REFERENCES "pickup_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_order_lines" ADD CONSTRAINT "rental_order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_order_lines" ADD CONSTRAINT "rental_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quantity_reservations" ADD CONSTRAINT "rental_quantity_reservations_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "rental_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quantity_reservations" ADD CONSTRAINT "rental_quantity_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_unit_assignments" ADD CONSTRAINT "rental_unit_assignments_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "rental_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_unit_assignments" ADD CONSTRAINT "rental_unit_assignments_equipment_unit_id_fkey" FOREIGN KEY ("equipment_unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_unit_assignments" ADD CONSTRAINT "rental_unit_assignments_replaced_from_id_fkey" FOREIGN KEY ("replaced_from_id") REFERENCES "rental_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "rental_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_equipment_unit_id_fkey" FOREIGN KEY ("equipment_unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tasks" ADD CONSTRAINT "inventory_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tasks" ADD CONSTRAINT "inventory_tasks_inventory_location_id_fkey" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tasks" ADD CONSTRAINT "inventory_tasks_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tasks" ADD CONSTRAINT "inventory_tasks_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_tasks" ADD CONSTRAINT "logistics_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_tasks" ADD CONSTRAINT "logistics_tasks_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_tasks" ADD CONSTRAINT "logistics_tasks_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_tasks" ADD CONSTRAINT "logistics_tasks_service_point_id_fkey" FOREIGN KEY ("service_point_id") REFERENCES "pickup_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_tasks" ADD CONSTRAINT "logistics_tasks_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_pickup_codes" ADD CONSTRAINT "rental_pickup_codes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_pickup_codes" ADD CONSTRAINT "rental_pickup_codes_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_handovers" ADD CONSTRAINT "rental_handovers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_handovers" ADD CONSTRAINT "rental_handovers_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_handovers" ADD CONSTRAINT "rental_handovers_logistics_task_id_fkey" FOREIGN KEY ("logistics_task_id") REFERENCES "logistics_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_handovers" ADD CONSTRAINT "rental_handovers_pickup_code_id_fkey" FOREIGN KEY ("pickup_code_id") REFERENCES "rental_pickup_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_handovers" ADD CONSTRAINT "rental_handovers_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_snapshots" ADD CONSTRAINT "condition_snapshots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_snapshots" ADD CONSTRAINT "condition_snapshots_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "rental_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_snapshots" ADD CONSTRAINT "condition_snapshots_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_snapshots" ADD CONSTRAINT "condition_snapshots_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_snapshots" ADD CONSTRAINT "condition_snapshots_taken_by_fkey" FOREIGN KEY ("taken_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "rental_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_exception_cases" ADD CONSTRAINT "rental_exception_cases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_exception_cases" ADD CONSTRAINT "rental_exception_cases_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "rental_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_exception_cases" ADD CONSTRAINT "rental_exception_cases_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_exception_cases" ADD CONSTRAINT "rental_exception_cases_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "return_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_exception_cases" ADD CONSTRAINT "rental_exception_cases_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_exception_cases" ADD CONSTRAINT "rental_exception_cases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_assessment_reviews" ADD CONSTRAINT "rental_assessment_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_assessment_reviews" ADD CONSTRAINT "rental_assessment_reviews_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "return_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_assessment_reviews" ADD CONSTRAINT "rental_assessment_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_assessment_reviews" ADD CONSTRAINT "rental_assessment_reviews_exception_case_id_fkey" FOREIGN KEY ("exception_case_id") REFERENCES "rental_exception_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlements" ADD CONSTRAINT "deposit_settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlements" ADD CONSTRAINT "deposit_settlements_rental_policy_id_fkey" FOREIGN KEY ("rental_policy_id") REFERENCES "rental_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlements" ADD CONSTRAINT "deposit_settlements_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlement_items" ADD CONSTRAINT "deposit_settlement_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "deposit_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlement_items" ADD CONSTRAINT "deposit_settlement_items_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "rental_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlement_items" ADD CONSTRAINT "deposit_settlement_items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlement_items" ADD CONSTRAINT "deposit_settlement_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "return_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_settlement_items" ADD CONSTRAINT "deposit_settlement_items_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_inventory_location_id_fkey" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_logistics_task_id_fkey" FOREIGN KEY ("logistics_task_id") REFERENCES "logistics_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_from_inventory_location_id_fkey" FOREIGN KEY ("from_inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_to_inventory_location_id_fkey" FOREIGN KEY ("to_inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_policies" ADD CONSTRAINT "gps_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_sessions" ADD CONSTRAINT "gps_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_sessions" ADD CONSTRAINT "gps_sessions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_sessions" ADD CONSTRAINT "gps_sessions_gps_policy_id_fkey" FOREIGN KEY ("gps_policy_id") REFERENCES "gps_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gps_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_deviation_events" ADD CONSTRAINT "route_deviation_events_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_deviation_events" ADD CONSTRAINT "route_deviation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_deviation_events" ADD CONSTRAINT "route_deviation_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gps_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_events" ADD CONSTRAINT "checkpoint_events_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_events" ADD CONSTRAINT "checkpoint_events_trip_checkpoint_id_fkey" FOREIGN KEY ("trip_checkpoint_id") REFERENCES "trip_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_events" ADD CONSTRAINT "checkpoint_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_events" ADD CONSTRAINT "checkpoint_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gps_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_actual_routes" ADD CONSTRAINT "trip_actual_routes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_actual_routes" ADD CONSTRAINT "trip_actual_routes_source_session_id_fkey" FOREIGN KEY ("source_session_id") REFERENCES "gps_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_snapshots" ADD CONSTRAINT "weather_snapshots_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_snapshots" ADD CONSTRAINT "weather_snapshots_trip_checkpoint_id_fkey" FOREIGN KEY ("trip_checkpoint_id") REFERENCES "trip_checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rental_order_id_fkey" FOREIGN KEY ("rental_order_id") REFERENCES "rental_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_trail_access_id_fkey" FOREIGN KEY ("trail_access_id") REFERENCES "trail_accesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_deposit_settlement_id_fkey" FOREIGN KEY ("deposit_settlement_id") REFERENCES "deposit_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_deposit_settlement_item_id_fkey" FOREIGN KEY ("deposit_settlement_item_id") REFERENCES "deposit_settlement_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_cancellation_id_fkey" FOREIGN KEY ("booking_cancellation_id") REFERENCES "booking_cancellations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_rental_order_id_fkey" FOREIGN KEY ("rental_order_id") REFERENCES "rental_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_trail_access_id_fkey" FOREIGN KEY ("trail_access_id") REFERENCES "trail_accesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ranks" ADD CONSTRAINT "user_ranks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ranks" ADD CONSTRAINT "user_ranks_rank_id_fkey" FOREIGN KEY ("rank_id") REFERENCES "ranks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_reviews" ADD CONSTRAINT "trip_reviews_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "trip_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_reviews" ADD CONSTRAINT "leader_reviews_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_reviews" ADD CONSTRAINT "leader_reviews_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_reviews" ADD CONSTRAINT "leader_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_reviews" ADD CONSTRAINT "rental_reviews_rental_order_id_fkey" FOREIGN KEY ("rental_order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_reviews" ADD CONSTRAINT "rental_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_reviews" ADD CONSTRAINT "rental_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================================
-- MANUAL POSTGRESQL CONSTRAINTS / PARTIAL INDEXES
-- Prisma PSL does not express these FINAL FLOW invariants directly.
-- =========================================================

-- ---------- Booking ----------
-- One non-terminal booking per user/trip. Expired holds must be transitioned to EXPIRED by the TTL job.
CREATE UNIQUE INDEX "uq_bookings_active_user_trip"
ON "bookings" ("user_id", "trip_id")
WHERE "status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN');

-- ---------- Rental basic checks ----------
ALTER TABLE "rental_quote_lines"
  ADD CONSTRAINT "chk_rental_quote_line_quantity_positive"
    CHECK ("quantity" > 0),
  ADD CONSTRAINT "chk_rental_quote_line_days_positive"
    CHECK ("charged_days" > 0),
  ADD CONSTRAINT "chk_rental_quote_line_money_non_negative"
    CHECK (
      "daily_price_snapshot" >= 0
      AND "deposit_per_unit_snapshot" >= 0
      AND "line_rental_fee" >= 0
      AND "line_deposit" >= 0
    );

ALTER TABLE "rental_order_lines"
  ADD CONSTRAINT "chk_rental_order_line_quantity_positive"
    CHECK ("quantity" > 0),
  ADD CONSTRAINT "chk_rental_order_line_days_positive"
    CHECK ("charged_days" > 0),
  ADD CONSTRAINT "chk_rental_order_line_money_non_negative"
    CHECK (
      "daily_price_snapshot" >= 0
      AND "deposit_per_unit_snapshot" >= 0
      AND "replacement_value_snapshot" >= 0
      AND "line_rental_fee" >= 0
      AND "line_deposit" >= 0
    );

ALTER TABLE "rental_quantity_reservations"
  ADD CONSTRAINT "chk_rental_quantity_reservation_quantity_positive"
    CHECK ("quantity" > 0),
  ADD CONSTRAINT "chk_rental_quantity_reservation_window"
    CHECK ("occupied_from" < "occupied_until");

ALTER TABLE "rental_orders"
  ADD CONSTRAINT "chk_rental_order_rental_window"
    CHECK ("rental_start_at" < "rental_end_at"),
  ADD CONSTRAINT "chk_rental_order_occupied_window"
    CHECK ("occupied_start_at" < "occupied_end_at"),
  ADD CONSTRAINT "chk_rental_order_window_contains_rental_window"
    CHECK (
      "occupied_start_at" <= "rental_start_at"
      AND "occupied_end_at" >= "rental_end_at"
    ),
  ADD CONSTRAINT "chk_rental_order_money_non_negative"
    CHECK (
      "rental_fee" >= 0
      AND "total_deposit" >= 0
      AND "total_amount" >= 0
    );

ALTER TABLE "rental_products"
  ADD CONSTRAINT "chk_rental_product_money_non_negative"
    CHECK (
      "daily_price" >= 0
      AND "replacement_value" >= 0
      AND "deposit_value" >= 0
    );

ALTER TABLE "deposit_settlement_items"
  ADD CONSTRAINT "chk_deposit_item_money_non_negative"
    CHECK (
      "deposit_amount" >= 0
      AND "deduction_amount" >= 0
      AND "refund_amount" >= 0
    ),
  ADD CONSTRAINT "chk_deposit_item_allocation"
    CHECK ("deduction_amount" + "refund_amount" <= "deposit_amount");

-- ---------- Rental active-state uniqueness ----------
-- MVP decision: at most one non-terminal RentalOrder per Booking.
CREATE UNIQUE INDEX "uq_rental_orders_one_open_per_booking"
ON "rental_orders" ("booking_id")
WHERE "status" NOT IN ('COMPLETED', 'CANCELLED', 'EXPIRED');

-- A physical unit cannot actively serve two assignments simultaneously.
CREATE UNIQUE INDEX "uq_rental_unit_assignments_active_unit"
ON "rental_unit_assignments" ("equipment_unit_id")
WHERE "status" IN ('ASSIGNED', 'PACKED', 'HANDED_OVER');

-- Only one active quantity-hold cycle per order line.
CREATE UNIQUE INDEX "uq_rental_quantity_reservation_active_line"
ON "rental_quantity_reservations" ("order_line_id")
WHERE "status" IN ('HELD', 'CONFIRMED');

-- ---------- Return inspection guard ----------
-- Logistics PRELIMINARY may only classify NORMAL/ISSUE/MISSING_PENDING_REVIEW.
-- Confirmed DAMAGE/LOST is reserved for FINAL deep review.
ALTER TABLE "return_inspections"
  ADD CONSTRAINT "chk_return_inspection_stage_outcome"
  CHECK (
    (
      "stage" = 'PRELIMINARY'
      AND "outcome" IN ('NORMAL', 'ISSUE', 'MISSING_PENDING_REVIEW')
    )
    OR
    (
      "stage" = 'FINAL'
      AND "outcome" IN ('NORMAL', 'DAMAGE_CONFIRMED', 'LOST_CONFIRMED')
    )
  );

-- ---------- GPS constraints explicitly documented by schema ----------
CREATE UNIQUE INDEX "uq_gps_sessions_active_user_trip"
ON "gps_sessions" ("user_id", "trip_id")
WHERE "status" IN ('ACTIVE', 'PAUSED');

ALTER TABLE "gps_locations"
  ADD CONSTRAINT "chk_gps_location_latitude"
    CHECK ("latitude" >= -90 AND "latitude" <= 90),
  ADD CONSTRAINT "chk_gps_location_longitude"
    CHECK ("longitude" >= -180 AND "longitude" <= 180),
  ADD CONSTRAINT "chk_gps_location_accuracy_non_negative"
    CHECK ("accuracy_m" IS NULL OR "accuracy_m" >= 0),
  ADD CONSTRAINT "chk_gps_location_speed_non_negative"
    CHECK ("speed_mps" IS NULL OR "speed_mps" >= 0),
  ADD CONSTRAINT "chk_gps_location_heading"
    CHECK ("heading_deg" IS NULL OR ("heading_deg" >= 0 AND "heading_deg" <= 360));

-- IMPORTANT: product-level quantity overbooking cannot be guaranteed by a simple CHECK/UNIQUE index.
-- Create RentalOrder + all RentalQuantityReservation rows in ONE application transaction:
-- 1) sort product IDs; 2) lock rental_products rows FOR UPDATE;
-- 3) recalculate eligible unit capacity and overlapping HELD/CONFIRMED quantity;
-- 4) rollback the whole order if any line is insufficient; 5) otherwise insert all holds and commit.

