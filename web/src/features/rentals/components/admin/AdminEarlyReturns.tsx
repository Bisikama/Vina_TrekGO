"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  ConfirmModal,
  EmptyState,
  ErrorAlert,
  FormField,
  LoadingState,
  Modal,
  SurfaceCard,
  Textarea,
} from "@/components/ui";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import {
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

export function AdminEarlyReturns() {
  const [filter, setFilter] = useState<AdminEarlyReturnFilter>("PENDING");
  const [items, setItems] = useState<AdminEarlyReturn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AdminEarlyReturn | null>(null);
  const [rejecting, setRejecting] = useState<AdminEarlyReturn | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

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
    setBusy(item.id);
    setError(null);
    try {
      await confirmEarlyReturn(item);
    } catch (e) {
      setError(getRentalApiErrorMessage(e, "Không xác nhận được lịch."));
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
                    <Link className="underline-offset-2 hover:underline" href={`/admin/rental-orders/${item.orderId}`}>
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
                  {item.status === "CONFIRMED" && item.task ? (
                    <p className="text-[#6B7280]">
                      Nhân viên: {item.task.staff?.fullName ?? "chưa phân công"} · task {item.task.status}
                    </p>
                  ) : null}
                </div>
                {item.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" loading={busy === item.id} disabled={!!busy} onClick={() => setConfirming(item)}>
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
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : items ? (
        <EmptyState title={filter === "PENDING" ? "Chưa có yêu cầu chờ xác nhận" : "Chưa có lịch trả đồ sớm đã xác nhận"} />
      ) : null}

      <ConfirmModal
        isOpen={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && void confirm(confirming)}
        title="Xác nhận lịch trả đồ sớm?"
        description={
          confirming
            ? `Task thu hồi của đơn ${orderCode(confirming.orderId)} sẽ được dời tới ${dateTime(confirming.requestedSlotAt)}. Hãy phân công nhân viên ở danh sách việc bên dưới.`
            : ""
        }
        confirmLabel="Xác nhận"
        loading={!!busy}
      />

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
