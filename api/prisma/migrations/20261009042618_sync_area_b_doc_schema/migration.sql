-- CreateEnum
CREATE TYPE "rental_document_type" AS ENUM ('HANDOVER', 'EXTENSION_APPENDIX', 'RETURN_RECEIPT', 'SCHEDULE_NOTICE', 'CORRECTION_NOTICE');

-- CreateEnum
CREATE TYPE "rental_document_render_status" AS ENUM ('PENDING_RENDER', 'READY', 'RENDER_FAILED');

-- CreateEnum
CREATE TYPE "rental_return_session_status" AS ENUM ('OPEN', 'FINALIZED');

-- AlterTable
ALTER TABLE "rental_extension_requests" ADD COLUMN     "accepted_at" TIMESTAMPTZ(6),
ADD COLUMN     "accepted_by_user_id" UUID,
ADD COLUMN     "accepted_terms_version" VARCHAR(40),
ADD COLUMN     "terms_hash" CHAR(64);

-- AlterTable
ALTER TABLE "rental_orders" ADD COLUMN     "operational_return_due_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "rental_policies" ADD COLUMN     "deep_inspection_buffer_minutes" INTEGER,
ADD COLUMN     "max_extension_count" INTEGER,
ADD COLUMN     "max_total_rental_days" INTEGER;

-- CreateTable
CREATE TABLE "rental_documents" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "document_type" "rental_document_type" NOT NULL,
    "source_ref" VARCHAR(180) NOT NULL,
    "source_version" INTEGER NOT NULL DEFAULT 1,
    "root_document_id" UUID,
    "previous_document_id" UUID,
    "appendix_no" INTEGER,
    "snapshot_json" JSONB NOT NULL,
    "snapshot_hash" CHAR(64) NOT NULL,
    "template_version" VARCHAR(30) NOT NULL DEFAULT '1.0',
    "policy_version" VARCHAR(30) NOT NULL DEFAULT '1.4.2',
    "render_status" "rental_document_render_status" NOT NULL DEFAULT 'PENDING_RENDER',
    "render_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "pdf_storage_key" VARCHAR(500),
    "pdf_hash" CHAR(64),
    "render_error" TEXT,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rendered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rental_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_return_sessions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "operation_id" VARCHAR(200) NOT NULL,
    "staff_id" UUID NOT NULL,
    "status" "rental_return_session_status" NOT NULL DEFAULT 'OPEN',
    "received_units" JSONB NOT NULL,
    "remarks" TEXT,
    "finalized_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_return_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_document_access_logs" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "accessed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rental_documents_document_number_key" ON "rental_documents"("document_number");

-- CreateIndex
CREATE INDEX "rental_documents_order_id_issued_at_idx" ON "rental_documents"("order_id", "issued_at");

-- CreateIndex
CREATE INDEX "rental_documents_root_document_id_issued_at_idx" ON "rental_documents"("root_document_id", "issued_at");

-- CreateIndex
CREATE INDEX "rental_documents_render_status_created_at_idx" ON "rental_documents"("render_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_documents_document_type_source_ref_key" ON "rental_documents"("document_type", "source_ref");

-- CreateIndex
CREATE UNIQUE INDEX "rental_documents_order_id_document_type_appendix_no_key" ON "rental_documents"("order_id", "document_type", "appendix_no");

-- CreateIndex
CREATE UNIQUE INDEX "rental_return_sessions_operation_id_key" ON "rental_return_sessions"("operation_id");

-- CreateIndex
CREATE INDEX "rental_return_sessions_order_id_status_idx" ON "rental_return_sessions"("order_id", "status");

-- CreateIndex
CREATE INDEX "rental_document_access_logs_document_id_accessed_at_idx" ON "rental_document_access_logs"("document_id", "accessed_at");

-- CreateIndex
CREATE INDEX "rental_document_access_logs_actor_user_id_accessed_at_idx" ON "rental_document_access_logs"("actor_user_id", "accessed_at");

-- AddForeignKey
ALTER TABLE "rental_extension_lines" ADD CONSTRAINT "rental_extension_lines_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "rental_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_custody_transfers" ADD CONSTRAINT "return_custody_transfers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_custody_transfers" ADD CONSTRAINT "return_custody_transfers_delivery_task_id_fkey" FOREIGN KEY ("delivery_task_id") REFERENCES "delivery_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_custody_transfers" ADD CONSTRAINT "return_custody_transfers_inventory_location_id_fkey" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_custody_transfers" ADD CONSTRAINT "return_custody_transfers_from_staff_id_fkey" FOREIGN KEY ("from_staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_documents" ADD CONSTRAINT "rental_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_documents" ADD CONSTRAINT "rental_documents_root_document_id_fkey" FOREIGN KEY ("root_document_id") REFERENCES "rental_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rental_documents" ADD CONSTRAINT "rental_documents_previous_document_id_fkey" FOREIGN KEY ("previous_document_id") REFERENCES "rental_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rental_return_sessions" ADD CONSTRAINT "rental_return_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_document_access_logs" ADD CONSTRAINT "rental_document_access_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "rental_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
