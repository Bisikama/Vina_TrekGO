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
  Select,
  SurfaceCard,
  Textarea,
} from "@/components/ui";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { getRentalDeliveryAssignees, type RentalAssignee } from "@/features/rentals/services/staff-preparation.api";
import {
  assignEarlyReturn,
  confirmEarlyReturn,
  listEarlyReturns,
  rejectEarlyReturn,
  type AdminEarlyReturn,
  type AdminEarlyReturnFilter,
} from "@/features/rentals/services/early-return.api";
import { orderCode } from "./admin-rental-labels";

const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

const TABS: Array<{ value: AdminEarlyReturnFilter; label: string }> = [
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
];

/**
 * Danh sách yêu cầu trả đồ sớm để xác nhận / từ chối lịch.
 * Dùng chung cho Admin và nhân viên kho: `audience` quyết định link đơn và lời nhắc sau khi xác nhận.
 */
export function AdminEarlyReturns({ audience = "admin" }: { audience?: "admin" | "staff" } = {}) {
  const orderHref = (orderId: string) =>
    audience === "staff" ? `/staff/orders/${orderId}` : `/admin/rental-orders/${orderId}`;
  const [filter, setFilter] = useState<AdminEarlyReturnFilter>("PENDING");
  const [items, setItems] = useState<AdminEarlyReturn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AdminEarlyReturn | null>(null);
  // "confirm": xác nhận lịch đang chờ + chọn người; "assign": giao / đổi người cho lịch đã xác nhận.
  const [mode, setMode] = useState<"confirm" | "assign">("confirm");
  const [rejecting, setRejecting] = useState<AdminEarlyReturn | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<RentalAssignee[] | null>(null);
  const [assigneesError, setAssigneesError] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeError, setAssigneeError] = useState<string | null>(null);

  function openConfirm(item: AdminEarlyReturn, nextMode: "confirm" | "assign" = "confirm") {
    setMode(nextMode);
    setAssigneeId(item.task?.staff?.id ?? "");
    setAssigneeError(null);
    setAssigneesError(null);
    setConfirming(item);
    // Tải lại mỗi lần mở để số việc đang giữ của từng người là số mới.
    setAssignees(null);
    getRentalDeliveryAssignees()
      .then((page) => setAssignees(page.items))
      .catch((e) => setAssigneesError(getRentalApiErrorMessage(e, "Không tải được danh sách nhân viên giao nhận.")));
  }

  const load = useCallback(async (status: AdminEarlyReturnFilter) => {
    try {
      setItems(await listEarlyReturns(status));
      setError(null);
    } catch (e) {
      setError(getRentalApiErrorMessage(e, "Không tải được yêu cầu trả đồ sớm."));
    }
  }, []);

  useEffect(() => {
    let active = true;
    listEarlyReturns(filter)
      .then((value) => {
        if (active) {
          setItems(value);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(getRentalApiErrorMessage(e, "Không tải được yêu cầu trả đồ sớm."));
      });
    return () => {
      active = false;
    };
  }, [filter]);

  async function confirm(item: AdminEarlyReturn) {
    // Không ai nhận task thì khách được hứa nhưng không ai đến: bắt buộc chọn người.
    if (!assigneeId) {
      setAssigneeError("Chọn nhân viên giao nhận sẽ đến lấy đồ.");
      return;
    }
    const keepCurrent = assigneeId === item.task?.staff?.id;
    if (mode === "assign" && keepCurrent) {
      setAssigneeError("Task đang giao cho nhân viên này; chọn người khác để đổi.");
      return;
    }
    setBusy(item.id);
    setError(null);
    try {
      if (mode === "assign") await assignEarlyReturn(item, assigneeId);
      else await confirmEarlyReturn(item, keepCurrent ? undefined : assigneeId);
    } catch (e) {
      setError(
        getRentalApiErrorMessage(e, mode === "assign" ? "Không giao được nhân viên." : "Không xác nhận được lịch."),
      );
    } finally {
      setConfirming(null);
      setBusy(null);
      await load(filter);
    }
  }

  async function reject() {
    if (!rejecting) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setReasonError("Nhập lý do ít nhất 3 ký tự để khách biết vì sao.");
      return;
    }
    setBusy(rejecting.id);
    setError(null);
    try {
      await rejectEarlyReturn(rejecting, trimmed);
      setRejecting(null);
      setReason("");
    } catch (e) {
      setRejecting(null);
      setError(getRentalApiErrorMessage(e, "Không từ chối được yêu cầu."));
    } finally {
      setBusy(null);
      await load(filter);
    }
  }

  return (
    <SurfaceCard className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#1F2937]">Yêu cầu trả đồ sớm</h2>
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant={filter === tab.value ? "primary" : "outline"}
              onClick={() => {
                setItems(null);
                setFilter(tab.value);
              }}
            >
              {tab.label}
            </Button>
          ))}
          <Button variant="secondary" size="sm" onClick={() => void load(filter)}>
            Làm mới
          </Button>
        </div>
      </div>

      {error ? <ErrorAlert className="mt-3" message={error} onDismiss={() => setError(null)} /> : null}

      {!items && !error ? (
        <LoadingState />
      ) : items?.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const slotAt = item.confirmedSlotAt ?? item.requestedSlotAt;
            return (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#E5E7EB] p-3">
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-semibold text-[#1F2937]">
                    <Link className="underline-offset-2 hover:underline" href={orderHref(item.orderId)}>
                      Đơn {orderCode(item.orderId)}
                    </Link>{" "}
                    · hẹn <span className="tabular-nums">{dateTime(slotAt)}</span>
                  </p>
                  <p className="text-[#6B7280]">
                    {item.requester.fullName}
                    {item.requester.phone ? ` · ${item.requester.phone}` : ""} · còn {item.order.outstandingUnits} thiết bị · hạn trả{" "}
                    <span className="tabular-nums">{dateTime(item.order.effectiveDueAt)}</span>
                  </p>
                  {item.order.returnPoint ? (
                    <p className="text-[#6B7280]">
                      Điểm trả: {item.order.returnPoint.name} — {item.order.returnPoint.address}
                    </p>
                  ) : null}
                  {item.status === "PENDING" && item.supersededAt ? (
                    <p className="text-[#B45309]">Chuyến đi đổi lịch, cần xác nhận lại.</p>
                  ) : null}
                  {item.task ? (
                    <p className={item.task.staff ? "text-[#6B7280]" : "text-[#B45309]"}>
                      Nhân viên giao nhận: {item.task.staff?.fullName ?? "chưa phân công"}
                      {item.status === "CONFIRMED" ? ` · task ${item.task.status}` : ""}
                    </p>
                  ) : null}
                </div>
                {item.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" loading={busy === item.id} disabled={!!busy} onClick={() => openConfirm(item)}>
                      Xác nhận lịch
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => {
                        setReason("");
                        setReasonError(null);
                        setRejecting(item);
                      }}
                    >
                      Từ chối
                    </Button>
                  </div>
                ) : item.status === "CONFIRMED" && item.task?.status === "SCHEDULED" ? (
                  <Button
                    size="sm"
                    variant={item.task.staff ? "outline" : "primary"}
                    loading={busy === item.id}
                    disabled={!!busy}
                    onClick={() => openConfirm(item, "assign")}
                  >
                    {item.task.staff ? "Đổi nhân viên" : "Giao nhân viên"}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : items ? (
        <EmptyState title={filter === "PENDING" ? "Chưa có yêu cầu chờ xác nhận" : "Chưa có lịch trả đồ sớm đã xác nhận"} />
      ) : null}

      <Modal
        isOpen={!!confirming}
        onClose={() => setConfirming(null)}
        title={mode === "assign" ? "Giao nhân viên giao nhận" : "Xác nhận lịch trả đồ sớm"}
        subtitle={
          confirming
            ? `Đơn ${orderCode(confirming.orderId)} · hẹn ${dateTime(confirming.confirmedSlotAt ?? confirming.requestedSlotAt)}`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={!!busy}>
              Đóng
            </Button>
            <Button loading={!!busy} disabled={!assignees} onClick={() => confirming && void confirm(confirming)}>
              {mode === "assign" ? "Giao việc" : "Xác nhận và giao việc"}
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-[#6B7280]">
          {mode === "assign"
            ? "Giờ hẹn giữ nguyên. Nhân viên mới nhận thông báo ngay, nhân viên cũ (nếu có) được báo không cần đi; khách thấy tên người sẽ đến."
            : "Task thu hồi sẽ được dời tới giờ khách chọn và giao cho nhân viên bên dưới; họ nhận thông báo ngay. Phí thuê và tiền cọc không đổi."}
        </p>
        {assigneesError ? <ErrorAlert className="mb-3" message={assigneesError} /> : null}
        {!assignees && !assigneesError ? (
          <LoadingState />
        ) : assignees ? (
          <FormField label="Nhân viên giao nhận đến lấy đồ" required error={assigneeError}>
            <Select
              aria-label="Nhân viên giao nhận"
              value={assigneeId}
              onChange={(e) => {
                setAssigneeError(null);
                setAssigneeId(e.target.value);
              }}
            >
              <option value="">— Chọn nhân viên —</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} · đang giữ {a.activeTaskCount} việc
                  {a.id === confirming?.task?.staff?.id ? " (đang nhận task này)" : ""}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Từ chối yêu cầu trả đồ sớm"
        subtitle={rejecting ? `Đơn ${orderCode(rejecting.orderId)} · hẹn ${dateTime(rejecting.requestedSlotAt)}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)} disabled={!!busy}>
              Đóng
            </Button>
            <Button variant="danger" loading={!!busy} onClick={() => void reject()}>
              Từ chối
            </Button>
          </div>
        }
      >
        <FormField label="Lý do (khách sẽ thấy)" required error={reasonError}>
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => {
              setReasonError(null);
              setReason(e.target.value);
            }}
            placeholder="Ví dụ: Không có nhân viên vào khung giờ này, vui lòng chọn sau 14:00."
          />
        </FormField>
      </Modal>
    </SurfaceCard>
  );
}
