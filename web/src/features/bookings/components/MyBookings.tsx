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
import { BookingCancellation } from './BookingCancellation';
import { BookingRefunds } from './BookingRefunds';
import { BookingTransactions } from './BookingTransactions';
import { BookingTripCancellationNotice, TripCancellationNotice } from './TripCancellationNotice';
import { useRefreshOnReturn } from '../hooks/useRefreshOnReturn';
import type { CancelBookingResponse } from '../types/booking.types';
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
  Button,
  Modal,
} from '@/components/ui';

const bookingIcons = {
  ticket: 'M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Zm10 0v3m0 3v2m0 3v3',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  overview: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  wallet: 'M3 8h18v12H3V8Zm0 0V5h15v3m-2 4h5v4h-5v-4Z',
  qr: 'M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM3 15h6v6H3v-6Zm12-3v3h3m3-3v6h-6v3m6 0h-3m-6-9h-1',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  refresh: 'M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9',
};
function BookingListIcon({ name, className = 'h-4 w-4' }: { name: keyof typeof bookingIcons; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={bookingIcons[name]} /></svg>;
}

export function MyBookings() {
  const { accessToken, user } = useAuth();
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

  const [activeTab, setActiveTab] = useState<'all' | 'bookings' | 'tickets' | 'transactions'>('all');
  const [cancellations, setCancellations] = useState<Record<string, { userId?: string; result: CancelBookingResponse }>>({});
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

  useRefreshOnReturn(loadTickets, !!accessToken);

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

  useEffect(() => {
    if (!qrTicket) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQrTicket(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [qrTicket]);

  if (!accessToken) {
    return (
      <PageShell maxWidth="md">
        <BookingSignIn />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="xl" withTopOffset={false}>
      <SurfaceCard padding="lg" className="relative overflow-hidden border-emerald-100">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-50/70" />
      <PageHeader
        className="relative [&_h1]:text-[#125238]"
        eyebrow="Vina TrekGO · Quản Lý Vé & Hành Trình"
        title="Đặt chỗ & Vé của tôi"
        subtitle="Vé tham gia, đơn đặt chỗ và các khoản hoàn trong cùng một nơi."
        actions={
          <Link
            href="/trips"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2F6B4F] px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-[#1F4A36] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F6B4F]"
          >
            Khám phá chuyến đi <BookingListIcon name="arrow" />
          </Link>
        }
      />
      <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-emerald-100 pt-4 text-xs text-[#527060]">
        <span className="flex items-center gap-2"><BookingListIcon name="ticket" />Nhận và quản lý vé cá nhân</span>
        <span className="flex items-center gap-2"><BookingListIcon name="qr" />Xuất trình QR tại điểm tập kết</span>
        <span className="flex items-center gap-2"><BookingListIcon name="wallet" />Theo dõi thanh toán & hoàn tiền</span>
      </div>
      </SurfaceCard>

      {/* Thanh chuyển tab */}
      <nav aria-label="Quản lý vé và đặt chỗ" className="grid grid-cols-2 gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-2 sm:grid-cols-4">
        {([
          { key: 'all', label: 'Tổng quan', icon: 'overview' },
          { key: 'tickets', label: 'Vé của tôi', icon: 'ticket', count: tickets.length },
          { key: 'bookings', label: 'Đơn đặt chỗ', icon: 'calendar', count: total },
          { key: 'transactions', label: 'Giao dịch', icon: 'wallet' },
        ] as const).map((tab) => <Button key={tab.key} variant={activeTab === tab.key ? 'primary' : 'ghost'} aria-pressed={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} leftIcon={<BookingListIcon name={tab.icon} />} className="w-full rounded-xl" style={{ color: activeTab === tab.key ? '#FFFFFF' : '#527060' }}>
          <span className="inline-flex items-center gap-2">{tab.label}{'count' in tab && <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${activeTab === tab.key ? 'bg-white/15' : 'bg-[#F0F5F2]'}`}>{tab.count}</span>}</span>
        </Button>)}
      </nav>

      {Object.values(cancellations).filter((entry) => entry.userId === user?.id).map(({ result }) => <div key={result.bookingId} className="space-y-2"><p className="text-sm font-semibold">Đặt chỗ #{result.bookingId.slice(0, 8)}</p><BookingRefunds bookingId={result.bookingId} cancellation={result} /></div>)}
      {activeTab === 'transactions' && <BookingTransactions />}

      {/* KHUNG 1: VÉ THAM GIA CÁ NHÂN (BAO GỒM VÉ ĐƯỢC BẠN BÈ GỬI TẶNG ĐÃ NHẬN) */}
      {(activeTab === 'tickets' || (activeTab === 'all' && tickets.length > 0)) && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold text-[#125238]">
              Vé tham gia của tôi ({tickets.length})
            </h2>
            <p className="text-xs text-[#6B7280]">
              Vé đã nhận vào tài khoản. Xuất trình mã QR để Leader điểm danh tại điểm tập kết.
            </p>
            </div><Button size="sm" variant="outline" loading={extraLoading} leftIcon={<BookingListIcon name="refresh" />} onClick={() => void loadTickets()}>Làm mới vé</Button>
          </div>

          {extraLoading && tickets.length === 0 ? (
            <LoadingState message="Đang tải danh sách vé tham gia..." />
          ) : tickets.length === 0 ? (
            <EmptyState icon={<BookingListIcon name="ticket" className="h-6 w-6" />} title="Vé của bạn sẽ xuất hiện tại đây" description="Nếu được bạn bè gửi tặng vé, hãy mở Lời mời trên thanh điều hướng để nhận vé." />
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => {
                const isCheckedIn = t.checkinStatus === 'CHECKED_IN';
                const isNoShow = t.checkinStatus === 'NO_SHOW';
                return (
                  <SurfaceCard
                    key={t.id}
                    as="article"
                    padding="none"
                    interactive
                    className="flex overflow-hidden rounded-2xl flex-col lg:flex-row"
                  >
                    <div className="min-w-0 flex-1 space-y-4 p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-auto inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#527060]"><BookingListIcon name="ticket" />Vé cá nhân <span className="font-mono text-[#8A9890]">#{t.id.slice(0, 8).toUpperCase()}</span></span>
                        {t.trip.status === 'CANCELLED' ? <StatusBadge status="CANCELLED" customLabel="Chuyến đã hủy" /> : isCheckedIn ? (
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

                      <h3 className="break-words text-lg font-bold leading-snug text-[#125238] sm:text-xl">
                        {t.trip.title}
                      </h3>
                      <TripCancellationNotice status={t.trip.status} compact />

                      <div className="grid grid-cols-2 gap-3 text-xs text-[#6B7280] sm:grid-cols-3">
                        <div><p className="mb-1 text-[10px] uppercase tracking-wide">Người tham gia</p><p className="break-words font-semibold text-[#374B40]">{t.participantName}</p></div>
                        <div><p className="mb-1 text-[10px] uppercase tracking-wide">Khởi hành</p><p className="font-medium text-[#374B40]">{formatBookingDateTime(t.trip.startAt)}</p></div>
                        {t.trip.destination?.name && (
                          <div className="col-span-2 sm:col-span-1"><p className="mb-1 text-[10px] uppercase tracking-wide">Điểm đến</p><p className="break-words font-medium text-[#374B40]">{t.trip.destination.name}</p></div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col justify-center gap-2 border-t border-dashed border-[#D8E3DC] bg-[#F5F9F6] p-4 lg:w-52 lg:border-l lg:border-t-0 lg:p-5">
                      {t.checkinCode && !isCheckedIn && !isNoShow && t.trip.status !== 'CANCELLED' && (
                        <Button
                          leftIcon={<BookingListIcon name="qr" />}
                          fullWidth
                          onClick={() => setQrTicket(t)}
                          className="rounded-xl text-xs"
                        >
                          Mã QR điểm danh
                        </Button>
                      )}
                      <Link
                        href={`/trips/${t.trip.id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#BDD4C6] bg-white px-3 text-xs font-semibold text-[#125238] transition hover:border-[#2F6B4F] hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6B4F]"
                      >
                        Xem chuyến đi <BookingListIcon name="arrow" />
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
              <h2 className="text-lg font-extrabold text-[#125238]">
                Đơn đặt chỗ do tôi mua ({total})
              </h2>
              <p className="text-xs text-[#6B7280]">
                Các đơn đặt chỗ do bạn trực tiếp tạo và thanh toán.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
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
                padding="none"
                className="overflow-hidden rounded-2xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge
                    status={b.status}
                    customLabel={BOOKING_STATUS_LABELS[b.status] || b.status}
                  />
                  <span className="font-mono text-[10px] text-[#8A9890]">#{b.id.slice(0, 8).toUpperCase()}</span></div>
                  <h3 className="break-words text-lg font-bold text-[#125238] sm:text-xl">
                    {b.trip?.title}
                  </h3>
                  {['PENDING_PAYMENT', 'CONFIRMED'].includes(b.status) && <BookingTripCancellationNotice bookingId={b.id} bookingStatus={b.status} onBookingChanged={() => { void refetch(); void loadTickets(); }} />}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280] tabular-nums">
                    <span>Khởi hành: {formatBookingDateTime(b.trip?.startAt)}</span>
                    <span>Số lượng: {b.participantCount} thành viên</span>
                  </div>
                </div>
                <div className="rounded-xl bg-[#F0F6F2] px-4 py-3 sm:text-right"><p className="text-[10px] uppercase tracking-wide text-[#527060]">Giá trị đặt chỗ</p><p className="mt-1 text-lg font-bold tabular-nums text-[#125238]">{formatMoneyVND(b.totalAmount)}</p></div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-5 py-4 sm:px-6">
                <span className="text-xs text-[#6B7280]">Quản lý vé và theo dõi thông tin đặt chỗ</span>
                <Link
                  href={`/bookings/${b.id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#BDD4C6] px-4 text-xs font-semibold text-[#125238] transition hover:border-[#2F6B4F] hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6B4F]"
                >
                  Chi tiết đặt chỗ <BookingListIcon name="arrow" />
                </Link>
                </div>
                {['PENDING_PAYMENT', 'CONFIRMED'].includes(b.status) && (!cancellations[b.id] || cancellations[b.id].userId !== user?.id) && <div className="border-t border-[#E5E7EB] px-5 py-3 sm:px-6 [&>div]:border-0 [&>div]:p-0 [&>div]:shadow-none"><BookingCancellation bookingId={b.id} onRefresh={() => { void refetch(); }} onCancelled={(result) => { setCancellations((previous) => ({ ...previous, [b.id]: { userId: user?.id, result } })); void refetch(); void loadTickets(); }} /></div>}
              </SurfaceCard>
            ))}
          </div>

          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            className="flex-wrap"
          />
        </section>
      )}

      {/* MODAL HIỂN THỊ MÃ QR CHECK-IN CHO VÉ CÁ NHÂN */}
      {qrTicket && qrTicket.checkinCode && (
        <div className="relative z-[150]">
          <Modal isOpen onClose={() => setQrTicket(null)} title="Mã QR điểm danh" subtitle={qrTicket.trip.title} maxWidth="sm" footer={<Button fullWidth onClick={() => setQrTicket(null)}>Đóng mã QR</Button>}>
          <div className="space-y-4 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                Mã vé #{qrTicket.id.slice(0, 8)}
              </span>
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

          </div>
          </Modal>
        </div>
      )}
    </PageShell>
  );
}
