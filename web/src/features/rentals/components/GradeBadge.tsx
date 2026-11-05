// Nhãn hạng sản phẩm thuê (Như mới / Sử dụng tốt) dạng bubble, dùng chung cho các màn thuê.
export type RentalGradeValue = "LIKE_NEW" | "GOOD_USED";

const GRADE_LABELS: Record<RentalGradeValue, string> = { LIKE_NEW: "Như mới", GOOD_USED: "Sử dụng tốt" };
const GRADE_STYLES: Record<RentalGradeValue, string> = {
  LIKE_NEW: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  GOOD_USED: "bg-amber-50 text-amber-700 ring-amber-200",
};

export function gradeLabel(grade: RentalGradeValue) {
  return GRADE_LABELS[grade];
}

export function GradeBadge({ grade, className = "" }: { grade: RentalGradeValue; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 align-middle text-[11px] font-medium leading-none ring-1 ring-inset ${GRADE_STYLES[grade]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {GRADE_LABELS[grade]}
    </span>
  );
}
