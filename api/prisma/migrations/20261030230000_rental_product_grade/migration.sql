-- Thuê đồ theo hai hạng (LIKE_NEW / GOOD_USED): mỗi hạng là một rental_products riêng, nối nhau bằng grade_group_id.
-- Additive only: cột mới nullable, không backfill. Sản phẩm hiện có giữ nguyên (không có hạng) và bán như cũ.

-- CreateEnum
CREATE TYPE "rental_grade" AS ENUM ('LIKE_NEW', 'GOOD_USED');

-- CreateEnum
CREATE TYPE "equipment_grade_decision" AS ENUM ('KEEP', 'DOWNGRADE');

-- AlterTable
ALTER TABLE "rental_products" ADD COLUMN     "grade" "rental_grade",
ADD COLUMN     "grade_group_id" UUID;

-- Nhóm và hạng phải đi cùng nhau: cùng NULL (sản phẩm thường) hoặc cùng có giá trị.
ALTER TABLE "rental_products" ADD CONSTRAINT "rental_products_grade_group_pair" CHECK (
  ("grade_group_id" IS NULL AND "grade" IS NULL)
  OR ("grade_group_id" IS NOT NULL AND "grade" IS NOT NULL)
);

-- Một nhóm có tối đa một sản phẩm cho mỗi hạng. Partial index (raw SQL, Prisma schema không biểu diễn được).
CREATE UNIQUE INDEX "uq_rental_products_grade_group_grade" ON "rental_products" ("grade_group_id", "grade")
  WHERE "grade_group_id" IS NOT NULL;

-- CreateTable
CREATE TABLE "equipment_grade_reviews" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "assignment_id" UUID,
    "decision" "equipment_grade_decision" NOT NULL,
    "from_product_id" UUID NOT NULL,
    "to_product_id" UUID,
    "from_grade" "rental_grade" NOT NULL,
    "to_grade" "rental_grade",
    "reason" TEXT,
    "note" TEXT,
    "evidence_ids" JSONB,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_grade_reviews_pkey" PRIMARY KEY ("id"),
    -- KEEP: không đổi sản phẩm. DOWNGRADE: chỉ LIKE_NEW -> GOOD_USED, sang sản phẩm khác, bắt buộc lý do.
    CONSTRAINT "equipment_grade_reviews_decision_shape" CHECK (
      ("decision" = 'KEEP' AND "to_product_id" IS NULL AND "to_grade" IS NULL)
      OR (
        "decision" = 'DOWNGRADE'
        AND "to_product_id" IS NOT NULL
        AND "to_product_id" <> "from_product_id"
        AND "from_grade" = 'LIKE_NEW'
        AND "to_grade" = 'GOOD_USED'
        AND "reason" IS NOT NULL
        AND length(btrim("reason")) > 0
      )
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_grade_reviews_assignment_id_key" ON "equipment_grade_reviews"("assignment_id");

-- CreateIndex
CREATE INDEX "equipment_grade_reviews_unit_id_created_at_idx" ON "equipment_grade_reviews"("unit_id", "created_at");

-- CreateIndex
CREATE INDEX "rental_products_grade_group_id_idx" ON "rental_products"("grade_group_id");

-- AddForeignKey
ALTER TABLE "equipment_grade_reviews" ADD CONSTRAINT "equipment_grade_reviews_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_grade_reviews" ADD CONSTRAINT "equipment_grade_reviews_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "rental_unit_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_grade_reviews" ADD CONSTRAINT "equipment_grade_reviews_from_product_id_fkey" FOREIGN KEY ("from_product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_grade_reviews" ADD CONSTRAINT "equipment_grade_reviews_to_product_id_fkey" FOREIGN KEY ("to_product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_grade_reviews" ADD CONSTRAINT "equipment_grade_reviews_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
