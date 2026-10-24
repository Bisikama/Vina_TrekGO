"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { MyTripsHeader } from './MyTripsHeader';
import { PrivateTripInvitationsInbox } from '../PrivateTripInvitationsInbox';
import { usePrivateTrips } from '../../hooks/usePrivateTrips';
import { bookingApiService, formatMoneyVND, BOOKING_STATUS_LABELS } from '@/features/bookings/services/booking.api';
import type { BookingSummary, PageResponse } from '@/features/bookings/types/booking.types';
import type { PrivateTrip } from '../../services/private-trips.api';

type TabType = 'ALL' | 'BOOKINGS' | 'PRIVATE' | 'INVITATIONS';

export const MyTripsLayout = () => {
  const { trips, busy, error, cancel } = usePrivateTrips();

  const { data: bookingsPage, isLoading: bookingsSwrLoading } = useSWR<PageResponse<BookingSummary>>(
    ['my-bookings', 1, 50, ''],
    () => bookingApiService.listMyBookings({ page: 1, pageSize: 50 }),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  const bookings = useMemo(() => {
    return (bookingsPage?.items || []).filter(
      (b) =>
        b.status === 'CONFIRMED' ||
        b.status === 'CHECKED_IN' ||
        b.status === 'COMPLETED' ||
        b.status === 'CANCELLED'
    );
  }, [bookingsPage]);

  const bookingsLoading = bookingsSwrLoading && !bookingsPage;

  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const now = new Date();

  // Private trips categorized
  const upcomingPrivate = trips.filter((t) => new Date(t.endAt) > now && t.status !== 'CANCELLED');
  const completedPrivate = trips.filter((t) => new Date(t.endAt) <= now && t.status !== 'CANCELLED');
  const cancelledPrivate = trips.filter((t) => t.status === 'CANCELLED');

  // Bookings categorized
  const upcomingBookings = bookings.filter(
    (b) => (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') && new Date(b.trip.endAt) > now
  );
  const completedBookings = bookings.filter(
    (b) => b.status === 'COMPLETED' || ((b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') && new Date(b.trip.endAt) <= now)
  );
  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED');

  const totalBookingsCount = upcomingBookings.length + completedBookings.length + cancelledBookings.length;
  const totalPrivateCount = upcomingPrivate.length + completedPrivate.length + cancelledPrivate.length;
  const totalAllCount = totalBookingsCount + totalPrivateCount;

  // Filter based on search query and activeTab
  const query = searchQuery.toLowerCase().trim();

  const filterPrivate = (list: PrivateTrip[]) => {
    if (activeTab === 'BOOKINGS') return [];
    if (!query) return list;
    return list.filter((t) => t.title.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query)));
  };

  const filterBookings = (list: BookingSummary[]) => {
    if (activeTab === 'PRIVATE') return [];
    if (!query) return list;
    return list.filter((b) => b.trip.title.toLowerCase().includes(query));
  };

  const filteredUpcomingPrivate = filterPrivate(upcomingPrivate);
  const filteredUpcomingBookings = filterBookings(upcomingBookings);
  const totalUpcoming = filteredUpcomingPrivate.length + filteredUpcomingBookings.length;

  const filteredCompletedPrivate = filterPrivate(completedPrivate);
  const filteredCompletedBookings = filterBookings(completedBookings);
  const totalCompleted = filteredCompletedPrivate.length + filteredCompletedBookings.length;

  const filteredCancelledPrivate = filterPrivate(cancelledPrivate);
  const filteredCancelledBookings = filterBookings(cancelledBookings);
  const totalCancelled = filteredCancelledPrivate.length + filteredCancelledBookings.length;

  const isInitialLoading = (busy && trips.length === 0) || (bookingsLoading && bookings.length === 0);

  return (
    <div className="bg-[#F7F7F4] min-h-screen pt-12 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <MyTripsHeader
          counts={{
            upcoming: upcomingPrivate.length + upcomingBookings.length,
            completed: completedPrivate.length + completedBookings.length,
            cancelled: cancelledPrivate.length + cancelledBookings.length,
            ongoing: 0,
          }}
          typeCounts={{
            all: totalAllCount,
            bookings: totalBookingsCount,
            privateTrips: totalPrivateCount,
          }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {isInitialLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="animate-spin h-9 w-9 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-medium text-gray-500">Đang tải danh sách chuyến đi của bạn...</p>
          </div>
        ) : activeTab === 'INVITATIONS' ? (
            <div className="mt-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span>✉️</span> Hộp thư lời mời tham gia chuyến đi riêng (Private Trip)
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Xem và phản hồi các lời mời do Host chuyến đi gửi trực tiếp tới email tài khoản của bạn.
                </p>
              </div>
              <PrivateTripInvitationsInbox />
            </div>
          ) : (
          <div className="mt-8 space-y-12">
            {/* Sắp tới */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Sắp tới ({totalUpcoming})
              </h2>

              {totalUpcoming > 0 ? (
                <div className="grid gap-6">
                  {/* Booked tours upcoming */}
                  {filteredUpcomingBookings.map((booking) => (
                    <BookedTripCard key={booking.id} booking={booking} />
                  ))}

                  {/* Private trips upcoming */}
                  {filteredUpcomingPrivate.map((trip) => (
                    <PrivateTripCard
                      key={trip.id}
                      trip={trip}
                      onCancel={() => cancel(trip, 'Hủy theo yêu cầu người dùng')}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center shadow-sm">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-800 font-bold mb-1">Bạn chưa có chuyến đi nào sắp diễn ra.</p>
                  <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                    Khám phá các tour ghép đoàn hấp dẫn hoặc tự lập kế hoạch trekking cùng bạn bè.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/trips"
                      className="px-5 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors text-sm shadow-sm"
                    >
                      Khám phá tour ghép đoàn
                    </Link>
                    <Link
                      href="/my-trips/create"
                      className="px-5 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-colors text-sm border border-emerald-200"
                    >
                      + Tổ chức chuyến riêng
                    </Link>
                  </div>
                </div>
              )}
            </section>

            {/* Đã hoàn thành */}
            {totalCompleted > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 opacity-75">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                  Đã hoàn thành ({totalCompleted})
                </h2>
                <div className="grid gap-6 opacity-85">
                  {filteredCompletedBookings.map((booking) => (
                    <BookedTripCard key={booking.id} booking={booking} />
                  ))}
                  {filteredCompletedPrivate.map((trip) => (
                    <PrivateTripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </section>
            )}

            {/* Đã hủy */}
            {totalCancelled > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 opacity-70">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                  Đã hủy ({totalCancelled})
                </h2>
                <div className="grid gap-6 opacity-65">
                  {filteredCancelledBookings.map((booking) => (
                    <BookedTripCard key={booking.id} booking={booking} />
                  ))}
                  {filteredCancelledPrivate.map((trip) => (
                    <PrivateTripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Booked Tour Card (Tour ghép đoàn user đã đặt và thanh toán)
// ============================================================================
const BookedTripCard = ({ booking }: { booking: BookingSummary }) => {
  const isCancelled = booking.status === 'CANCELLED';
  const isCompleted =
    booking.status === 'COMPLETED' || (new Date(booking.trip.endAt) <= new Date() && !isCancelled);
  const isUpcoming = !isCancelled && !isCompleted;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border ${
        isCancelled ? 'border-red-100' : 'border-emerald-100/80 hover:border-emerald-300'
      } overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-md group relative`}
    >
      {/* Decorative side bar */}
      <div
        className={`w-2 md:w-3 shrink-0 ${
          isCancelled ? 'bg-red-400' : isCompleted ? 'bg-gray-400' : 'bg-emerald-600'
        }`}
      ></div>

      <div className="p-6 md:p-8 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              {/* Type badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-teal-50 text-teal-800 border border-teal-200">
                <svg className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Tour đã đặt
              </span>

              {/* Status badge */}
              <span
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase ${
                  booking.status === 'CONFIRMED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : isCancelled
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                {booking.status === 'CONFIRMED'
                  ? '✓ Đã thanh toán & Xác nhận'
                  : BOOKING_STATUS_LABELS[booking.status] || booking.status}
              </span>

              <span className="text-xs font-medium text-gray-400">
                Mã đặt: #{booking.id.substring(0, 8)}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 leading-tight">
              {booking.trip.title}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 gap-y-6 mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Khởi hành</p>
              <p className="font-semibold text-gray-900">{formatDate(booking.trip.startAt)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Số lượng & Thanh toán</p>
              <p className="font-semibold text-gray-900">{booking.participantCount} thành viên</p>
              <p className="text-xs text-emerald-700 font-bold">{formatMoneyVND(booking.totalAmount)}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <Link
              href={`/trips/${booking.trip.id}`}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors text-center shadow-sm"
            >
              Bản đồ cung đường GPS
            </Link>
            <Link
              href={`/bookings/${booking.id}`}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors text-center ${
                isUpcoming
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Xem chi tiết chuyến đi →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Private Trip Card (Chuyến riêng tự tổ chức)
// ============================================================================
const PrivateTripCard = ({ trip, onCancel }: { trip: any; onCancel?: () => void }) => {
  const isCancelled = trip.status === 'CANCELLED';
  const isCompleted = new Date(trip.endAt) <= new Date() && !isCancelled;
  const isUpcoming = !isCancelled && !isCompleted;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border ${
        isCancelled ? 'border-red-100' : 'border-gray-200'
      } overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-md group relative`}
    >
      {/* Decorative side bar */}
      <div
        className={`w-2 md:w-3 shrink-0 ${
          isCancelled ? 'bg-red-400' : isCompleted ? 'bg-gray-400' : 'bg-emerald-500'
        }`}
      ></div>

      <div className="p-6 md:p-8 flex-1">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              {/* Type badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-amber-50 text-amber-800 border border-amber-200">
                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Chuyến tự tổ chức
              </span>

              <span
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase ${
                  isCancelled
                    ? 'bg-red-50 text-red-700'
                    : isCompleted
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {trip.status}
              </span>
              <span className="text-xs font-medium text-gray-400">ID: {trip.id.substring(0, 8)}...</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 leading-tight">{trip.title}</h3>
          </div>

          {isUpcoming && onCancel && (
            <button
              onClick={() => {
                if (window.confirm('Chắc chắn hủy chuyến?')) onCancel();
              }}
              className="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors opacity-0 group-hover:opacity-100"
            >
              Hủy chuyến
            </button>
          )}
        </div>

        <p className="text-gray-500 text-sm mb-6 line-clamp-2 max-w-3xl">
          {trip.description || 'Chưa có mô tả cho chuyến đi này.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-6 pt-4 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Khởi hành</p>
              <p className="font-semibold text-gray-900">{formatDate(trip.startAt)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Thành viên</p>
              <p className="font-semibold text-gray-900">Tối đa {trip.maxPax} người</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Nguồn tuyến đường</p>
              <p className="font-semibold text-gray-900">
                {trip.tripType === 'PERSONAL' ? 'Bản đồ cá nhân' : 'Bản đồ hệ thống'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start justify-end md:items-end">
            <Link
              href={`/my-trips/${trip.id}`}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors w-full text-center md:w-auto ${
                isUpcoming
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Xem Chi Tiết & Quản Lý
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

