"use client";

import React, { useEffect, useState } from 'react';
import { MyTripsHeader } from './MyTripsHeader';
import { usePrivateTrips } from '../../hooks/usePrivateTrips';
import Link from 'next/link';

export const MyTripsLayout = () => {
  const { trips, loadTrips, busy, error, revoke, cancel } = usePrivateTrips();
  
  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const upcomingTrips = trips.filter(t => new Date(t.endAt) > new Date() && t.status !== 'CANCELLED');
  const completedTrips = trips.filter(t => new Date(t.endAt) <= new Date() && t.status !== 'CANCELLED');
  const cancelledTrips = trips.filter(t => t.status === 'CANCELLED');

  return (
    <div className="bg-[#F7F7F4] min-h-screen pt-12 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <MyTripsHeader 
          counts={{
            upcoming: upcomingTrips.length,
            completed: completedTrips.length,
            cancelled: cancelledTrips.length,
            ongoing: 0 // Could add logic if needed
          }} 
        />
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {busy && trips.length === 0 ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
        ) : (
          <div className="mt-8 space-y-12">
            
            {/* Sắp tới */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 
                Sắp tới ({upcomingTrips.length})
              </h2>
              {upcomingTrips.length > 0 ? (
                <div className="grid gap-6">
                  {upcomingTrips.map(trip => (
                    <PrivateTripCard key={trip.id} trip={trip} onCancel={() => cancel(trip, "Hủy theo yêu cầu người dùng")} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                  <p className="text-gray-500 mb-4">Bạn chưa có chuyến đi nào sắp diễn ra.</p>
                  <Link href="/my-trips/create" className="inline-block px-6 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 transition-colors">
                    + Tổ chức ngay
                  </Link>
                </div>
              )}
            </section>

            {/* Đã hoàn thành */}
            {completedTrips.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 opacity-60">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> 
                  Đã hoàn thành ({completedTrips.length})
                </h2>
                <div className="grid gap-6 opacity-80">
                  {completedTrips.map(trip => (
                    <PrivateTripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </section>
            )}

            {/* Đã hủy */}
            {cancelledTrips.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 opacity-60">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> 
                  Đã hủy ({cancelledTrips.length})
                </h2>
                <div className="grid gap-6 opacity-60">
                  {cancelledTrips.map(trip => (
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

const PrivateTripCard = ({ trip, onCancel }: { trip: any, onCancel?: () => void }) => {
  const isCancelled = trip.status === 'CANCELLED';
  const isCompleted = new Date(trip.endAt) <= new Date() && !isCancelled;
  const isUpcoming = !isCancelled && !isCompleted;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${isCancelled ? 'border-red-100' : 'border-gray-200'} overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-md group relative`}>
      {/* Decorative side bar */}
      <div className={`w-2 md:w-3 ${isCancelled ? 'bg-red-400' : isCompleted ? 'bg-gray-400' : 'bg-emerald-500'}`}></div>
      
      <div className="p-6 md:p-8 flex-1">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase ${isCancelled ? 'bg-red-50 text-red-700' : isCompleted ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700'}`}>
                {trip.status}
              </span>
              <span className="text-xs font-medium text-gray-400">ID: {trip.id.substring(0, 8)}...</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 leading-tight">
              {trip.title}
            </h3>
          </div>
          
          {isUpcoming && onCancel && (
            <button 
              onClick={() => { if(window.confirm('Chắc chắn hủy chuyến?')) onCancel(); }}
              className="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors opacity-0 group-hover:opacity-100"
            >
              Hủy chuyến
            </button>
          )}
        </div>

        <p className="text-gray-500 text-sm mb-6 line-clamp-2 max-w-3xl">
          {trip.description || 'Chưa có mô tả cho chuyến đi này.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Khởi hành</p>
              <p className="font-semibold text-gray-900">{formatDate(trip.startAt)}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Thành viên</p>
              <p className="font-semibold text-gray-900">Tối đa {trip.maxPax} người</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Nguồn tuyến đường</p>
              <p className="font-semibold text-gray-900">{trip.tripType === 'PERSONAL' ? 'Bản đồ cá nhân' : 'Bản đồ hệ thống'}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-start justify-end md:items-end">
            <Link 
              href={`/my-trips/${trip.id}`} 
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors w-full text-center md:w-auto ${
                isUpcoming ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200' : 
                'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
