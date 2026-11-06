"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Button,
  EmptyState,
  ErrorAlert,
  FormField,
  LoadingState,
  Modal,
  PageHeader,
  PageShell,
  PaginationBar,
  Select,
  StatusBadge,
  SurfaceCard,
  Textarea,
  Input,
} from "@/components/ui";
import {
  assignAdminRentalTask,
  listAdminRentalTasks,
  type AdminRentalTask,
  type AdminRentalTaskType,
} from "@/features/rentals/services/admin-rental.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { getRentalAssignees } from "@/features/rentals/services/staff-overview.api";
import type { RentalAssignee } from "@/features/rentals/services/staff-preparation.api";
import { AdminEarlyReturns } from "./AdminEarlyReturns";
import {
  orderCode,
  taskStatusBadge,
  TASK_TYPE_LABELS,
  formatDateTime,
} from "@/features/rentals/components/admin/admin-rental-labels";

// Admin phân công việc chuẩn bị kho / giao đồ / thu hồi (GET /admin/rental-tasks, POST /admin/rental-tasks/:id/assign).

const PAGE_SIZE = 20;

// Trạng thái còn giao lại được (theo quy tắc backend RB-API-408).
const INVENTORY_LOCKED = new Set(["TRANSFERRED", "CLOSED", "CANCELLED"]);
const DELIVERY_ASSIGNABLE = new Set(["SCHEDULED", "BLOCKED"]);

const isInventoryTask = (type: AdminRentalTaskType) => type === "PREPARATION" || type === "WAREHOUSE";

function canAssign(task: AdminRentalTask) {
  return isInventoryTask(task.type) ? !INVENTORY_LOCKED.has(task.status) : DELIVERY_ASSIGNABLE.has(task.status);
}

type Filters = { type: "" | AdminRentalTaskType; date: string; assignment: "" | "UNASSIGNED" | "ASSIGNED" };

export function AdminRentalTasks() {
  const [filters, setFilters] = useState<Filters>({ type: "", date: "", assignment: "" });
  const [page, setPage] = useState(1);
  const [tasks, setTasks] = useState<AdminRentalTask[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [assigning, setAssigning] = useState<AdminRentalTask | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setTasks(null);
    setError(null);
    listAdminRentalTasks(
      {
        type: filters.type || undefined,
        date: filters.date || undefined,
        assignment: filters.assignment || undefined,
        page,
        pageSize: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setTasks(result.items);
        setTotal(result.totalItems);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(getRentalApiErrorMessage(reason, "Không tải được danh sách việc."));
        setTasks([]);
      });
    return () => controller.abort();
  }, [filters, page, reloadKey]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <PageShell maxWidth="full" withTopOffset={false}>
      <PageHeader
        eyebrow="Quản trị · Thuê thiết bị"
        title="Phân công việc"
        description="Giao việc chuẩn bị kho, giao đồ và thu hồi cho nhân viên phụ trách."
        actions={
          <Button variant="secondary" size="sm" onClick={reload}>
            Làm mới
          </Button>
        }
      />

      <AdminEarlyReturns />
      <SurfaceCard padding="sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Loại việc">
            <Select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as Filters["type"])}>
              <option value="">Tất cả</option>
              <option value="PREPARATION">Chuẩn bị kho</option>
              <option value="OUTBOUND">Giao đồ</option>
              <option value="RETURN">Thu hồi</option>
            </Select>
          </FormField>
          <FormField label="Ngày">
            <Input type="date" value={filters.date} onChange={(event) => updateFilter("date", event.target.value)} />
          </FormField>
          <FormField label="Phân công">
            <Select
              value={filters.assignment}
              onChange={(event) => updateFilter("assignment", event.target.value as Filters["assignment"])}
            >
              <option value="">Tất cả</option>
              <option value="UNASSIGNED">Chưa giao</option>
              <option value="ASSIGNED">Đã giao</option>
            </Select>
          </FormField>
        </div>
      </SurfaceCard>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      ) : null}
      {error ? <ErrorAlert message={error} onRetry={reload} /> : null}

      {tasks === null ? (
        <LoadingState message="Đang tải danh sách việc..." />
      ) : tasks.length === 0 && !error ? (
        <EmptyState title="Không có việc phù hợp" description="Thử đổi loại việc, ngày hoặc trạng thái phân công." />
      ) : tasks.length > 0 ? (
        <SurfaceCard padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F7F7F4] text-xs font-medium text-[#6B7280]">
                  <th className="px-4 py-3">Việc</th>
                  <th className="px-4 py-3">Đơn thuê</th>
                  <th className="px-4 py-3">Thời hạn / lịch</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Người phụ trách</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {tasks.map((task) => {
                  const badge = taskStatusBadge(task.status);
                  return (
                    <tr key={`${task.type}-${task.id}`} className="hover:bg-[#F7F7F4]/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1F2937]">{TASK_TYPE_LABELS[task.type] ?? task.type}</p>
                        {task.point?.name ? <p className="text-xs text-[#6B7280]">{task.point.name}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/rental-orders/${task.orderId}`}
                          className="font-mono text-xs font-medium text-[#2F6B4F] hover:underline"
                        >
                          {orderCode(task.orderId)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#1F2937]">{formatDateTime(task.scheduledAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={badge.status} customLabel={badge.label} />
                      </td>
                      <td className="px-4 py-3">
                        {task.assignee ? (
                          <span className="text-[#1F2937]">{task.assignee.displayName || "Nhân viên"}</span>
                        ) : (
                          <span className="text-[#6B7280]">Chưa giao</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canAssign(task) ? (
                          <Button size="sm" variant={task.assignee ? "outline" : "primary"} onClick={() => setAssigning(task)}>
                            {task.assignee ? "Đổi người" : "Giao việc"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#E5E7EB] px-4 py-3">
            <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} itemLabel="việc" />
          </div>
        </SurfaceCard>
      ) : null}

      {assigning ? (
        <AssignDialog
          task={assigning}
          onClose={() => setAssigning(null)}
          onAssigned={(name) => {
            setAssigning(null);
            setNotice(`Đã giao ${TASK_TYPE_LABELS[assigning.type]?.toLowerCase() ?? "việc"} của đơn ${orderCode(assigning.orderId)} cho ${name}.`);
            reload();
          }}
        />
      ) : null}
    </PageShell>
  );
}

function AssignDialog({
  task,
  onClose,
  onAssigned,
}: {
  task: AdminRentalTask;
  onClose: () => void;
  onAssigned: (assigneeName: string) => void;
}) {
  const role = isInventoryTask(task.type) ? "STAFF_INVENTORY" : "STAFF_DELIVERY";
  const [assignees, setAssignees] = useState<RentalAssignee[] | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getRentalAssignees(role, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setAssignees(items);
        const first = items.find((item) => item.id !== task.assignee?.id);
        setAssigneeId(first?.id ?? "");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(getRentalApiErrorMessage(reason, "Không tải được danh sách nhân viên."));
        setAssignees([]);
      });
    return () => controller.abort();
  }, [role, task.assignee?.id]);

  const reasonValid = reason.trim().length >= 3;

  async function submit() {
    if (!assigneeId || !reasonValid) return;
    setSaving(true);
    setError(null);
    try {
      const result = await assignAdminRentalTask({
        taskId: task.id,
        taskType: task.type,
        assigneeId,
        reason: reason.trim(),
        expectedVersion: task.version,
      });
      const name =
        result.assignee?.displayName ||
        assignees?.find((item) => item.id === assigneeId)?.displayName ||
        "nhân viên";
      onAssigned(name);
    } catch (reason: unknown) {
      setError(getRentalApiErrorMessage(reason, "Chưa giao được việc. Thử tải lại danh sách rồi giao lại."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!saving) onClose();
      }}
      title={task.assignee ? "Đổi người phụ trách" : "Giao việc"}
      subtitle={`${TASK_TYPE_LABELS[task.type] ?? task.type} · đơn ${orderCode(task.orderId)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button onClick={() => void submit()} loading={saving} disabled={!assigneeId || !reasonValid}>
            Giao việc
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <ErrorAlert message={error} /> : null}
        {task.assignee ? (
          <p className="text-sm text-[#6B7280]">
            Đang phụ trách: <span className="font-medium text-[#1F2937]">{task.assignee.displayName || "Nhân viên"}</span>
          </p>
        ) : null}
        <FormField label={role === "STAFF_INVENTORY" ? "Nhân viên kho" : "Nhân viên giao nhận"} required>
          {assignees === null ? (
            <p className="text-sm text-[#6B7280]">Đang tải danh sách nhân viên...</p>
          ) : assignees.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Chưa có nhân viên phù hợp.</p>
          ) : (
            <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              {assignees.map((item) => (
                <option key={item.id} value={item.id} disabled={item.id === task.assignee?.id}>
                  {item.displayName} · {item.activeTaskCount > 0 ? `${item.activeTaskCount} việc đang giữ` : "đang rảnh"}
                  {item.id === task.assignee?.id ? " (hiện tại)" : ""}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Lý do"
          required
          hint="Ít nhất 3 ký tự, được lưu vào lịch sử phân công."
          error={reason.length > 0 && !reasonValid ? "Lý do quá ngắn." : null}
        >
          <Textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: nhân viên A nghỉ ca, chuyển cho nhân viên B"
          />
        </FormField>
        {!isInventoryTask(task.type) ? (
          <p className="text-xs text-[#6B7280]">
            Chỉ đổi người phụ trách, không chuyển trách nhiệm giữ đồ. Việc giao nhận chỉ giao lại được khi còn ở trạng thái Đã lên lịch hoặc Bị chặn.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
