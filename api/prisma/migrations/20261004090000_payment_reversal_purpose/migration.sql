-- Commit the enum extension before a subsequent migration uses its value.
ALTER TYPE "refund_purpose" ADD VALUE 'TECHNICAL_REVERSAL';
