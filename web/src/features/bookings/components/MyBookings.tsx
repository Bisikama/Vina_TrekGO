'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/features/auth';
import { useMyBookings } from '../hooks';
import {
  BOOKING_STATUS_LABELS,
  bookingApiService,
  formatBookingDateTime,
  formatMoneyVND,
  type PersonalTicket,
} from '../services/booking.api';
import { BookingSignIn } from './BookingSignIn';
import {
  PageShell,
  PageHeader,
  SurfaceCard,
  StatusBadge,
  Select,
  LoadingState,
  EmptyState,
  ErrorAlert,
  PaginationBar,
} from '@/components/ui';

export function MyBookings() {
  const { accessToken } = useAuth();
  const {
    bookings,
    total,
    page,
    pageSize,
    isLoading,
    error,
    status,
    setStatus,
    setPage,
    refetch,
  } = useMyBookings();

  const [activeTab, setActiveTab] = useState<'all' | 'bookings' | 'tickets'>('all');
  const [tickets, setTickets] = useState<PersonalTicket[]>([]);
  const [extraLoading, setExtraLoading] = useState(false);
  const [qrTicket, setQrTicket] = useState<PersonalTicket | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('vnp_ResponseCode') || url.searchParams.has('resultCode')) {
        window.location.replace(`/payment-return?${url.searchParams.toString()}`);
      }
    }
  }, []);

  const loadTickets = useCallback(async () => {
    if (!accessToken) return;
    setExtraLoading(true);
    try {
      const ticketRes = await bookingApiService.listMyTickets({ page: 1, pageSize: 20 });
      setTickets(ticketRes.items || []);
    } catch (err) {
      console.warn('Could not load personal tickets:', err);
    } finally {
      setExtraLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const handleInvitationUpdated = () => {
      void loadTickets();
      void refetch();
    };
    window.addEventListener('trekgo:invitations-updated', handleInvitationUpdated);
    return () => {
      window.removeEventListener('trekgo:invitations-updated', handleInvitationUpdated);
    };
  }, [loadTickets, refetch]);

  if (!accessToken) {
    return (
      <PageShell maxWidth="md">
        <BookingSignIn />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="Vina TrekGO · Quản Lý Vé & Hành Trình"
        title="Đặt chỗ & Vé của tôi"
        subtitle="Quản lý đơn đặt chỗ bạn đã mua, vé tham gia cá nhân và mã QR điểm danh."
        actions={
          <Link
            href="/trips"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#2F6B4F] px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-[#1F4A36]"
          >
            Khám phá chuyến đi khác
          </Link>
        }
      />

      {/* Thanh chuyển tab */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[#125238] text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Tất cả tổng quan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'tickets'
              ? 'bg-[#125238] text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Vé tham gia của tôi ({tickets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'bookings'
              ? 'bg-[#125238] text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Đơn đặt chỗ đã mua ({total})
        </button>
      </div>

      {/* KHUNG 1: VÉ THAM GIA CÁ NHÂN (BAO GỒM VÉ ĐƯỢC BẠN BÈ GỬI TẶNG ĐÃ NHẬN) */}
      {(activeTab === 'tickets' || (activeTab === 'all' && tickets.length > 0)) && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-extrabold text-[#1F2937]">
              Vé tham gia của tôi ({tickets.length})
            </h2>
            <p className="text-xs text-[#6B7280]">
              Vé đã định danh vào tài khoản của bạn (vé được bạn bè gửi tặng hoặc vé bạn tự nhận). Dùng mã QR này để Leader điểm danh.
            </p>
          </div>

          {extraLoading && tickets.length === 0 ? (
            <LoadingState message="Đang tải danh sách vé tham gia..." />
          ) : tickets.length === 0 ? (
            <SurfaceCard className="text-center py-8 text-xs text-gray-500">
              Bạn chưa có vé cá nhân nào được liên kết. Nếu bạn bè gửi vé cho bạn, hãy mở mục &ldquo;Lời mời&rdquo; trên thanh Header để xác nhận nhận vé.
            </SurfaceCard>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => {
                const isCheckedIn = t.checkinStatus === 'CHECKED_IN';
                const isNoShow = t.checkinStatus === 'NO_SHOW';
                return (
                  <SurfaceCard
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                          Vé định danh cá nhân
                        </span>
                        {isCheckedIn ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            Đã điểm danh ({t.checkinMethod === 'QR' ? 'Quét QR' : 'Thủ công'})
                          </span>
                        ) : isNoShow ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                            Vắng mặt
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            Chưa điểm danh
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-[#1F2937]">
                        {t.trip.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280]">
                        <span>
                          Họ tên vé: <strong className="text-gray-900">{t.participantName}</strong>
                        </span>
                        <span>Khởi hành: {formatBookingDateTime(t.trip.startAt)}</span>
                        {t.trip.destination?.name && (
                          <span>Điểm đến: {t.trip.destination.name}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {t.checkinCode && !isCheckedIn && !isNoShow && (
                        <button
                          type="button"
                          onClick={() => setQrTicket(t)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#125238] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#1F4A36] cursor-pointer"
                        >
                          Mã QR Check-in
                        </button>
                      )}
                      <Link
                        href={`/trips/${t.trip.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-[#125238] px-3.5 text-xs font-bold text-[#125238] transition hover:bg-[#2F6B4F]/10"
                      >
                        Xem chuyến đi →
                      </Link>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* KHUNG 2: ĐƠN ĐẶT CHỖ DO TÔI MUA */}
      {(activeTab === 'all' || activeTab === 'bookings') && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#1F2937]">
                Đơn đặt chỗ do tôi mua ({total})
              </h2>
              <p className="text-xs text-[#6B7280]">
                Các đơn đặt chỗ do bạn trực tiếp tạo và thanh toán.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <label htmlFor="booking-status-filter" className="text-xs font-bold text-[#6B7280]">
                Lọc trạng thái:
              </label>
              <div className="w-52">
                <Select
                  id="booking-status-filter"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(BOOKING_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {error && <ErrorAlert message={error} onRetry={refetch} />}

          {isLoading && !error && (
            <LoadingState message="Đang tải danh sách đặt chỗ của bạn..." />
          )}

          {!isLoading && bookings.length === 0 && !error && (
            <EmptyState
              title="Chưa có đơn đặt chỗ nào do bạn mua"
              description="Nếu bạn được bạn bè gửi tặng vé, hãy bấm vào mục 'Lời mời' trên thanh Header để nhận vé."
              action={
                <Link
                  href="/trips"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2F6B4F] px-4 text-xs font-semibold text-white transition hover:bg-[#1F4A36]"
                >
                  Xem lịch khởi hành
                </Link>
              }
            />
          )}

          <div className="space-y-4">
            {bookings.map((b) => (
              <SurfaceCard
                key={b.id}
                as="article"
                interactive
                className="flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <StatusBadge
                    status={b.status}
                    customLabel={BOOKING_STATUS_LABELS[b.status] || b.status}
                  />
                  <h2 className="text-lg sm:text-xl font-bold text-[#1F2937]">
                    {b.trip?.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280] tabular-nums">
                    <span>Khởi hành: {formatBookingDateTime(b.trip?.startAt)}</span>
                    <span>Số lượng: {b.participantCount} thành viên</span>
                    <span className="font-semibold text-[#1F2937]">
                      Tổng tiền: {formatMoneyVND(b.totalAmount)}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/bookings/${b.id}`}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[#125238] px-4 text-xs font-bold text-[#125238] transition hover:bg-[#2F6B4F]/10"
                >
                  Xem chi tiết vé →
                </Link>
              </SurfaceCard>
            ))}
          </div>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </section>
      )}

      {/* MODAL HIỂN THỊ MÃ QR CHECK-IN CHO VÉ CÁ NHÂN */}
      {qrTicket && qrTicket.checkinCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                Mã vé #{qrTicket.id.slice(0, 8)}
              </span>
              <h3 className="text-lg font-bold text-gray-900 mt-1">Mã QR Điểm Danh Chuyến Đi</h3>
              <p className="text-xs text-gray-500 mt-0.5">{qrTicket.trip.title}</p>
            </div>

            <div className="mx-auto inline-flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-100 bg-emerald-50/40 p-4 shadow-inner">
              <QRCodeSVG
                value={qrTicket.checkinCode}
                size={220}
                fgColor="#125238"
                includeMargin
              />
              <p className="mt-2 text-[11px] font-mono font-bold text-emerald-900">
                {qrTicket.participantName}
              </p>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Đưa mã QR này cho Trưởng đoàn (Leader) quét tại điểm đón tập kết để xác nhận có mặt.
            </p>

            <button
              type="button"
              onClick={() => setQrTicket(null)}
              className="w-full rounded-xl bg-gray-900 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition cursor-pointer"
            >
              Đóng lại
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
