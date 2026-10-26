'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  privateTripsApi as api,
  PrivateSource,
  PrivateTrip,
  PrivateInput,
} from '../services/private-trips.api';
import {
  privateTripMembershipApi,
  TripMember,
} from '../services/private-trip-membership.api';
import {
  PageShell,
  PageHeader,
  SurfaceCard,
  SurfaceSectionHeader,
  Button,
  FormField,
  Input,
  Select,
  Textarea,
  StatusBadge,
  ErrorAlert,
  EmptyState,
} from '@/components/ui';

const local = (date: string) => {
  const d = new Date(date);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

function message(e: unknown) {
  if (axios.isAxiosError<{ error?: { message?: string; code?: string } }>(e))
    return e.response?.data?.error?.message || e.message;
  return e instanceof Error ? e.message : 'Không thể thực hiện thao tác';
}

export function PrivateTrips() {
  const { user, accessToken } = useAuth();
  const [sources, setSources] = useState<PrivateSource[]>([]);
  const [trips, setTrips] = useState<PrivateTrip[]>([]);
  const [trip, setTrip] = useState<PrivateTrip | null>(null);
  const [sourceKey, setSourceKey] = useState('');
  const [destination, setDestination] = useState('');
  const [pickups, setPickups] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);

  const source = sources.find((s) => `${s.type}:${s.id}` === sourceKey);

  useEffect(() => {
    let cancelled = false;
    if (!accessToken || user?.role !== 'USER') return;
    (async () => {
      try {
        const s = await api.sources();
        if (cancelled) return;
        const t = await api.list();
        if (!cancelled) {
          setSources(s);
          setTrips(t);
        }
      } catch (e) {
        if (!cancelled) setError(message(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, user?.role]);

  useEffect(() => {
    let cancelled = false;
    if (!destination) return;
    api
      .pickups(destination)
      .then((p) => {
        if (!cancelled) setPickups(p);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [destination]);

  useEffect(() => {
    let cancelled = false;
    if (!trip?.id) return;
    privateTripMembershipApi
      .getMembers(trip.id, { status: 'ACTIVE', pageSize: 50 })
      .then((res) => {
        if (!cancelled) setMembers(res.items || []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.id]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
      setTrips(await api.list());
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const editable =
    !trip || (trip.status === 'OPEN' && new Date(trip.startAt) > new Date());

  return (
    <PageShell maxWidth="xl">
      <PageHeader
        eyebrow="Vina TrekGO · Nhóm Trekking Tự Tổ Chức"
        title="Chuyến đi riêng tư"
        subtitle="Sử dụng tuyến đường cá nhân hoặc tuyến đường hệ thống đã mở khóa để lên lịch trình và mời bạn bè tham gia."
        actions={
          accessToken &&
          user?.role === 'USER' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const t = await api.list();
                    setTrips(t);
                    if (trip)
                      setTrip(t.find((x) => x.id === trip.id) ?? null);
                  })
                }
              >
                ↻ Tải lại dữ liệu
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setTrip(null);
                  setSourceKey('');
                  setDestination('');
                  setPickups([]);
                  setInvite(null);
                }}
              >
                + Tạo chuyến mới
              </Button>
            </>
          )
        }
      />

      {!accessToken ? (
        <EmptyState
          icon="🔐"
          title="Vui lòng đăng nhập để tiếp tục"
          description="Tính năng tổ chức chuyến đi riêng tư yêu cầu tài khoản thành viên."
          action={
            <Link
              href="/public/login"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2F6B4F] px-4 text-xs font-semibold text-white transition hover:bg-[#1F4A36]"
            >
              Đăng nhập ngay
            </Link>
          }
        />
      ) : user?.role !== 'USER' ? (
        <EmptyState
          title="Tính năng dành riêng cho tài khoản USER"
          description="Tài khoản Trưởng đoàn (Leader) quản lý chuyến đi công khai tại trang Dành cho Leader."
        />
      ) : (
        <>
          {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <SurfaceCard padding="sm" className="h-fit space-y-2">
              <p className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Danh sách chuyến đã tạo ({trips.length})
              </p>
              {trips.length === 0 ? (
                <p className="px-2 py-4 text-xs text-[#6B7280]">
                  Chưa có chuyến đi nào.
                </p>
              ) : (
                trips.map((t) => {
                  const isSelected = trip?.id === t.id;
                  return (
                    <button
                      type="button"
                      disabled={busy}
                      key={t.id}
                      onClick={() => {
                        setTrip(t);
                        setDestination(t.destinationId);
                        setPickups([]);
                        setInvite(null);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'border-[#125238] bg-[#2F6B4F]/10 text-[#125238]'
                          : 'border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F7F7F4]'
                      }`}
                    >
                      <span className="truncate">{t.title}</span>
                      <StatusBadge status={t.status} showDot={false} />
                    </button>
                  );
                })
              )}
            </SurfaceCard>

            <div className="space-y-6">
              <SurfaceCard padding="md" className="space-y-5">
                <SurfaceSectionHeader
                  title={
                    trip ? `Chi tiết: ${trip.title}` : 'Thiết lập chuyến đi mới'
                  }
                  subtitle={
                    trip
                      ? `Phiên bản dữ liệu #${trip.version}`
                      : 'Chọn tuyến đường nguồn và điền lịch trình dự kiến'
                  }
                  action={trip && <StatusBadge status={trip.status} />}
                />

                {!trip && (
                  <div className="space-y-4">
                    <FormField label="Tuyến đường (Trail nguồn)" required>
                      <Select
                        value={sourceKey}
                        disabled={busy}
                        onChange={(e) => {
                          const s = sources.find(
                            (x) => `${x.type}:${x.id}` === e.target.value
                          );
                          setSourceKey(e.target.value);
                          setDestination(s?.destinationId || '');
                          setPickups([]);
                        }}
                      >
                        <option value="">-- Chọn tuyến đường --</option>
                        {sources.map((s) => (
                          <option
                            key={`${s.type}:${s.id}`}
                            value={`${s.type}:${s.id}`}
                          >
                            {s.name} ({s.type})
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    {source && !source.destinationId && (
                      <FormField
                        label="ID điểm đến của trail chưa gắn địa điểm"
                        required
                      >
                        <Input
                          value={destination}
                          onChange={(e) => {
                            setDestination(e.target.value);
                            setPickups([]);
                          }}
                          placeholder="UUID điểm đến"
                        />
                      </FormField>
                    )}

                    {source && (
                      <div className="rounded-xl bg-[#F7F7F4] border border-[#E5E7EB] p-3.5 space-y-1.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                          Checkpoint theo thứ tự tuyến đường (
                          {source.points.length})
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {source.points.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center rounded-full bg-white border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-[#1F2937]"
                            >
                              {p.sequence}. {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <form
                  key={trip ? `${trip.id}:${trip.version}` : sourceKey}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      const data: PrivateInput = {
                        title: String(f.get('title')),
                        description: String(f.get('description')),
                        startAt: new Date(String(f.get('start'))).toISOString(),
                        endAt: new Date(String(f.get('end'))).toISOString(),
                        capacity: Number(f.get('capacity')),
                        pickupPointId: String(f.get('pickup')),
                      };
                      const t = trip
                        ? await api.update(trip, data)
                        : await api.create({
                            ...data,
                            type: source!.type,
                            trailRef: source!.id,
                            destinationId: destination,
                            checkpointIds: source!.points.map((p) => p.id),
                          });
                      setTrip(t);
                      setInvite(null);
                    });
                  }}
                >
                  <fieldset
                    disabled={busy || !editable}
                    className="space-y-4"
                  >
                    <FormField label="Tên chuyến đi" required>
                      <Input
                        name="title"
                        required
                        maxLength={220}
                        defaultValue={trip?.title}
                        placeholder="Ví dụ: Chinh phục đỉnh Bidoup cuối tuần"
                      />
                    </FormField>

                    <FormField label="Mô tả kế hoạch">
                      <Textarea
                        name="description"
                        maxLength={5000}
                        defaultValue={trip?.description || ''}
                        placeholder="Ghi chú vật dụng cần chuẩn bị, quy định của nhóm..."
                      />
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Thời gian bắt đầu" required>
                        <Input
                          name="start"
                          type="datetime-local"
                          required
                          defaultValue={trip ? local(trip.startAt) : ''}
                        />
                      </FormField>

                      <FormField label="Thời gian kết thúc" required>
                        <Input
                          name="end"
                          type="datetime-local"
                          required
                          defaultValue={trip ? local(trip.endAt) : ''}
                        />
                      </FormField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Sức chứa tối đa (người)" required>
                        <Input
                          name="capacity"
                          type="number"
                          min={1}
                          max={2147483647}
                          required
                          defaultValue={trip?.maxPax || 5}
                        />
                      </FormField>

                      <FormField label="Điểm tập kết" required>
                        <Select
                          name="pickup"
                          key={`${trip?.pickupPointId}-${pickups
                            .map((p) => p.id)
                            .join()}`}
                          required
                          defaultValue={trip?.pickupPointId || ''}
                        >
                          <option value="">-- Chọn điểm tập kết --</option>
                          {pickups.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        loading={busy}
                        disabled={!trip && (!source || !destination)}
                      >
                        {trip ? 'Lưu thay đổi' : 'Tạo chuyến OPEN'}
                      </Button>
                    </div>
                  </fieldset>
                </form>
              </SurfaceCard>

              {trip && (
                <SurfaceCard padding="md" className="space-y-4">
                  <SurfaceSectionHeader
                    title={`Tài khoản tham gia (${members.length} / ${trip.maxPax})`}
                    action={
                      <Link
                        href={`/trip-room/${trip.id}`}
                        className="text-xs font-bold text-[#125238] hover:underline"
                      >
                        Vào phòng chờ nhóm →
                      </Link>
                    }
                  />
                  {members.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {members.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] px-3.5 py-2.5"
                        >
                          <div>
                            <span className="font-semibold text-[#1F2937]">
                              {m.displayName ||
                                m.user?.fullName ||
                                `Tài khoản #${m.userId.slice(0, 8)}`}
                            </span>
                            <span className="ml-2 text-xs text-[#6B7280]">
                              ({m.role === 'HOST' ? 'Trưởng đoàn' : 'Thành viên'}{' '}
                              · ID: {m.userId.slice(0, 8)})
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[#6B7280]">
                      Chưa có thành viên nào.
                    </p>
                  )}
                </SurfaceCard>
              )}

              {trip && editable && (
                <SurfaceCard padding="md" className="space-y-5">
                  <SurfaceSectionHeader
                    title="Quản lý lời mời & Hủy chuyến"
                    subtitle="Tạo mã QR mời bạn bè hoặc hủy lịch trình trước giờ khởi hành"
                  />

                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const expiry = String(
                        new FormData(e.currentTarget).get('expiry')
                      );
                      void run(async () => {
                        const result = await api.invite(
                          trip,
                          expiry ? new Date(expiry).toISOString() : undefined
                        );
                        setTrip({ ...trip, version: result.tripVersion });
                        setInvite({
                          code: result.inviteCode,
                          expiresAt: result.expiresAt,
                        });
                      });
                    }}
                  >
                    <FormField
                      label="Hết hạn lời mời (trước giờ khởi hành)"
                      className="flex-1 min-w-[220px]"
                    >
                      <Input name="expiry" type="datetime-local" />
                    </FormField>
                    <Button type="submit" variant="primary" disabled={busy}>
                      Tạo / tạo lại mã QR mời
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setTrip(await api.revoke(trip));
                          setInvite(null);
                        })
                      }
                    >
                      Thu hồi mã mời
                    </Button>
                  </form>

                  {invite && (
                    <div
                      role="status"
                      className="inline-flex flex-col items-center gap-2 rounded-xl border border-[#E5E7EB] p-4 bg-[#F7F7F4]"
                    >
                      <QRCodeSVG
                        value={
                          typeof window !== 'undefined'
                            ? `${window.location.origin}/invite/${invite.code}`
                            : `/invite/${invite.code}`
                        }
                        size={160}
                        fgColor="#125238"
                        includeMargin
                      />
                      <span className="text-xs text-[#6B7280] tabular-nums">
                        Hết hạn:{' '}
                        {new Date(invite.expiresAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  )}

                  <form
                    className="flex flex-wrap items-end gap-3 pt-3 border-t border-[#E5E7EB]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const reason = String(
                        new FormData(e.currentTarget).get('reason')
                      );
                      void run(async () => {
                        setTrip(await api.cancel(trip, reason));
                        setInvite(null);
                      });
                    }}
                  >
                    <FormField
                      label="Lý do hủy chuyến"
                      className="flex-1 min-w-[220px]"
                    >
                      <Input
                        name="reason"
                        maxLength={2000}
                        placeholder="Nhập lý do hủy chuyến đi..."
                      />
                    </FormField>
                    <Button type="submit" variant="danger" disabled={busy}>
                      Hủy chuyến riêng tư
                    </Button>
                  </form>
                </SurfaceCard>
              )}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
