-- CreateEnum
CREATE TYPE "checkpoint_type" AS ENUM ('START', 'CAMPSITE', 'SUMMIT', 'WATER_SOURCE', 'VIEWPOINT', 'END');

-- AlterTable
ALTER TABLE "checkpoints" 
  ALTER COLUMN "checkpoint_type" TYPE "checkpoint_type" 
  USING ("checkpoint_type"::"checkpoint_type");
