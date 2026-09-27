"use client";
import React, { useState } from 'react';
import { StatCards } from './DashboardOverview/StatCards';

export const AdminDashboard = () => {
  const [activeTime, setActiveTime] = useState('Tháng này');
  const [alerts, setAlerts] = useState([
    {
      id: 1,
      type: 'sos',
      title: '[SOS] Sự cố #SOS-8921',
      time: '22 phút trước',
      desc: 'Mất tín hiệu Garmin InReach tại Km 9.2 Bạch Mộc Lương Tử. Trạm cứu hộ Sàng Ma Sáo đã xuất kích.',
      action: 'Điều phối ngay →',
      color: 'red'
    },
    {
      id: 2,
      type: 'review',
      title: '[Thẩm định Cung đường]',
      time: '',
      desc: 'Tuyến Hố Thấu - Tả Củ Tỷ do Trekker Vũ Trí gửi thiếu dữ liệu trắc địa đồ dốc 3 checkpoint.',
      action: 'Xem hồ sơ',
      color: 'amber'
    }
  ]);

  const handleAlertAction = (id: number) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const times = ['Hôm nay', '7 ngày qua', 'Tháng này', 'Tùy chọn'];

  return (
    <div className="p-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            VFRS LIVE TELEMETRY • NODE VN-NORTH
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan Quản trị Hệ thống</h1>
          <p className="text-sm text-gray-500 mt-1">Giám sát vận hành thời gian thực, điều phối an toàn và thẩm định nghiệp vụ toàn hệ thống Trekking System.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
            {times.map(t => (
              <button 
                key={t}
                onClick={() => setActiveTime(t)}
                className={`px-3 py-1.5 text-xs rounded transition-all flex items-center gap-1 ${
                  activeTime === t 
                    ? 'font-bold bg-white shadow-sm text-emerald-700' 
                    : 'font-medium text-gray-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                {t === 'Tùy chọn' && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                {t}
              </button>
            ))}
          </div>
          
          <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất báo cáo
          </button>
          <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Làm mới (Live)
          </button>
        </div>
      </div>

      <StatCards />

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-96 flex flex-col justify-center items-center text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Biểu đồ số chuyến đi theo tháng (Mock)
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-96 flex flex-col justify-center items-center text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            Bản đồ Giám sát Cung đường Hoạt động (VFRS Map Mock)
          </div>
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Mục cần chú ý khẩn cấp
              </h3>
              <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100">{alerts.length} việc quan trọng</span>
            </div>
            
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">Không có cảnh báo khẩn cấp nào.</div>
              ) : alerts.map(alert => (
                <div key={alert.id} className={`border rounded-lg p-4 ${alert.color === 'red' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                   <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${alert.color === 'red' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                            {alert.color === 'red' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            )}
                         </div>
                         <div>
                            <h4 className={`font-bold text-sm ${alert.color === 'red' ? 'text-red-900' : 'text-amber-900'}`}>{alert.title}</h4>
                            {alert.time && <div className={`text-xs mt-0.5 ${alert.color === 'red' ? 'text-red-700' : 'text-amber-800'}`}>• {alert.time}</div>}
                            <div className={`text-xs mt-1 mb-2 ${alert.color === 'red' ? 'text-red-800' : 'text-amber-800'}`}>{alert.desc}</div>
                            <button 
                              onClick={() => handleAlertAction(alert.id)}
                              className={`${alert.color === 'red' ? 'bg-red-700 hover:bg-red-800' : 'bg-amber-700 hover:bg-amber-800'} text-white text-xs font-bold px-4 py-1.5 rounded transition-colors`}
                            >
                              {alert.action}
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-64 flex flex-col justify-center items-center text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Cảnh báo Tồn kho Vật tư (Mock)
          </div>
        </div>
      </div>
    </div>
  );
};
