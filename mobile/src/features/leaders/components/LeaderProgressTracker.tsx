import { Colors, Radius, Shadows } from "@/constants/theme";
import type { FieldWorkflowState } from "@/context/AppContext";
import { StyleSheet, Text, View } from "react-native";

interface LeaderProgressTrackerProps {
  fieldWorkflow: FieldWorkflowState;
}

export function LeaderProgressTracker({ fieldWorkflow }: LeaderProgressTrackerProps) {
  const checkedInCount = fieldWorkflow.leaderAttendance.filter(
    (member: { memberName: string; status: string }) => member.status === "CHECKED_IN",
  ).length;
  const checkpointCount = fieldWorkflow.completedCheckpointIds.length;
  const requiredCheckpointCount = fieldWorkflow.requiredCheckpointIds.length;

  const percent =
    fieldWorkflow.leaderTripStatus === "COMPLETED"
      ? "100%"
      : fieldWorkflow.leaderTripStatus === "IN_PROGRESS"
        ? `${requiredCheckpointCount ? Math.round((checkpointCount / requiredCheckpointCount) * 100) : 0}%`
        : "0%";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TIẾN ĐỘ ĐIỀU HÀNH</Text>
          <Text style={styles.title}>Lộ trình công việc</Text>
        </View>
        <Text style={styles.percent}>{percent}</Text>
      </View>

      <ProgressStep
        index="01"
        title="Pre-trip & điểm danh"
        detail={
          fieldWorkflow.leaderPretripApproved
            ? `${checkedInCount} thành viên đã check-in`
            : `${checkedInCount}/${fieldWorkflow.leaderAttendance.length} đã xử lý`
        }
        active={!fieldWorkflow.leaderPretripApproved}
        done={fieldWorkflow.leaderPretripApproved}
      />
      <ProgressStep
        index="02"
        title="Điều hành trên tuyến"
        detail={
          fieldWorkflow.leaderTripStatus === "IN_PROGRESS"
            ? `${checkpointCount}/${requiredCheckpointCount} checkpoint`
            : "Chưa mở phiên GPS"
        }
        active={fieldWorkflow.leaderTripStatus === "IN_PROGRESS"}
        done={fieldWorkflow.leaderTripStatus === "COMPLETED"}
      />
      <ProgressStep
        index="03"
        title="Tổng kết & bàn giao"
        detail={
          fieldWorkflow.leaderReportSent
            ? "Đã gửi báo cáo cho vận hành"
            : "Chưa gửi báo cáo"
        }
        active={fieldWorkflow.leaderTripStatus === "COMPLETED"}
        done={fieldWorkflow.leaderReportSent}
        last
      />
    </View>
  );
}

function ProgressStep({
  index,
  title,
  detail,
  active,
  done,
  last = false,
}: {
  index: string;
  title: string;
  detail: string;
  active: boolean;
  done: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.leftCol}>
        <View style={[styles.badge, done && styles.badgeDone, active && styles.badgeActive]}>
          <Text style={[styles.badgeText, (done || active) && styles.badgeTextWhite]}>
            {index}
          </Text>
        </View>
        {!last && <View style={[styles.line, done && styles.lineDone]} />}
      </View>
      <View style={styles.rightCol}>
        <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>{title}</Text>
        <Text style={styles.stepDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: Radius.md,
    padding: 18,
    marginTop: 16,
    ...Shadows.card,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  eyebrow: {
    color: Colors.onSurfaceMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    color: Colors.ink,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  percent: {
    color: Colors.primaryDark,
    fontSize: 22,
    fontWeight: "900",
  },
  step: {
    flexDirection: "row",
    gap: 14,
  },
  leftCol: {
    alignItems: "center",
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#e8ece5",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDone: {
    backgroundColor: Colors.primaryDark,
  },
  badgeActive: {
    backgroundColor: "#3a7d2c",
  },
  badgeText: {
    color: Colors.body,
    fontSize: 11,
    fontWeight: "800",
  },
  badgeTextWhite: {
    color: "#fff",
  },
  line: {
    width: 2,
    height: 28,
    backgroundColor: "#e8ece5",
    marginVertical: 3,
  },
  lineDone: {
    backgroundColor: Colors.primaryDark,
  },
  rightCol: {
    flex: 1,
    paddingBottom: 16,
  },
  stepTitle: {
    color: Colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  stepTitleActive: {
    color: Colors.primaryDark,
  },
  stepDetail: {
    color: Colors.onSurfaceMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
