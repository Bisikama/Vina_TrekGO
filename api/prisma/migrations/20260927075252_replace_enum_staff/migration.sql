/*
  Warnings:

  - The values [STAFF_LOGISTICS] on the enum `user_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "user_role_new" AS ENUM ('USER', 'LEADER', 'STAFF_INVENTORY', 'STAFF_DELIVERY', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING ("role"::text::"user_role_new");
ALTER TABLE "checkpoint_events" ALTER COLUMN "role_at_event" TYPE "user_role_new" USING ("role_at_event"::text::"user_role_new");
ALTER TYPE "user_role" RENAME TO "user_role_old";
ALTER TYPE "user_role_new" RENAME TO "user_role";
DROP TYPE "user_role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;
