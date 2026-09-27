"use client";

import React, { useState } from 'react';
import Link from 'next/link';

const applicants = [
  {
    id: '#APPL-2024-042',
    name: 'Hoàng Thu Trang',
    phone: '0982 *** 849',
    email: 'trang.hoang@trekmail.vn',
    cert: 'WFA Cấp 1 (Y tế)',
    skills: ['Leo núi thể thao QG', '5+ năm KN Fansipan'],
    date: '24/10/2024',
    time: '09:30 AM',
    priority: true,
    score: '28 / 30',
    percentage: '93.3%',
    status: 'ĐẠT',
    stage: '3. Phỏng vấn thực địa',
    stageNote: 'Hội đồng Tây Bắc đánh giá',
    actionText: 'Thẩm định hồ sơ',
    actionType: 'primary',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop'
  },
  {
    id: '#APPL-2024-039',
    name: 'Bùi Quang Huy',
    phone: '0915 *** 621',
    email: 'huy.bui@mountainops.vn',
    cert: 'Cứu hộ địa hình dốc',
    skills: ['Cựu VĐV việt dã'],
    date: '23/10/2024',
    time: '14:15 PM',
    priority: false,
    score: '25 / 30',
    percentage: '83.3%',
    status: 'ĐẠT',
    stage: '4. Quyết định cấp thẻ',
    stageNote: 'Chờ Giám đốc VFRS ký',
    actionText: 'Phê duyệt',
    actionType: 'secondary',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100&auto=format&fit=crop'
  },
  {
    id: '#APPL-2024-037',
    name: 'Đỗ Quốc Tuấn',
    phone: '0973 *** 118',
    email: 'tuan.do@vietnamtrek.com',
    cert: 'Hướng dẫn viên Quốc Tế',
    skills: ['Định vị GPS / Bản đồ địa hình'],
    date: '22/10/2024',
    time: '10:05 AM',
    priority: false,
    score: '',
    percentage: '',
    status: 'Đang làm bài trắc nghiệm',
    stage: '2. Bài thi kiến thức',
    stageNote: 'Vòng 2 / 4 giai đoạn',
    actionText: 'Chi tiết',
    actionType: 'default',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop'
  },
  {
    id: '#APPL-2024-034',
    name: 'Lê Hoàng Long',
    phone: '0904 *** 332',
    email: 'long.le@trailadventures.vn',
    cert: 'Trekking Tà Xùa',
    skills: [],
    date: '21/10/2024',
    time: '16:40 PM',
    priority: false,
    score: '19 / 30',
    percentage: '63.3%',
    status: 'TRƯỢT',
    stage: 'Không đạt bài thi',
    stageNote: 'Có thể thi lại sau 30 ngày',
    actionText: 'Gửi phản hồi',
    actionType: 'default',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop'
  },
  {
    id: '#APPL-2024-031',
    name: 'Phạm Minh Đức',
    phone: '0936 *** 758',
    email: 'duc.pm@trekkingvn.org',
    cert: 'WFA Quốc Tế',
    skills: ['Kỹ năng sinh tồn Rừng sâu'],
    date: '19/10/2024',
    time: '11:20 AM',
    priority: false,
    score: '30 / 30',
    percentage: '100%',
    status: 'TUYỆT ĐỐI',
    stage: '4. Quyết định cấp thẻ',
    stageNote: 'Chờ kích hoạt ID Leader',
    actionText: 'Cấp thẻ Leader',
    actionType: 'primary',
    avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=100&auto=format&fit=crop'
  }
];

export const LeaderManagement = () => {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            <span>Quản trị hệ thống</span>
            <span className="mx-2">&gt;</span>
            <span className="font-medium text-gray-900">Quản lý Leader</span>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Mountain Leader</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              48 Leader hoạt động • 12 Hồ sơ ứng tuyển
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Quản lý hồ sơ cấp phép dẫn đoàn, thẩm định năng lực thực địa, theo dõi chỉ số an toàn và điều phối Mountain Leader toàn hệ thống.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất báo cáo
          </button>
          <button className="px-4 py-2 bg-[#1B5E41] text-white rounded-lg text-sm font-medium hover:bg-[#144a33] flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Mời ứng tuyển Leader
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-gray-500">Tổng Leader hoạt động</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-3">48</div>
          <div className="flex text-xs font-medium gap-3">
            <span className="text-emerald-600 flex items-center"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> +4 tháng này</span>
            <span className="text-gray-500">• 98% đạt chuẩn VFRS</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-gray-500">Hồ sơ ứng tuyển mới</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-3">12</div>
          <div className="flex gap-2 text-xs font-medium">
             <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md">3 duyệt gấp</span>
             <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md">5 đang thi trắc nghiệm</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-gray-500">Điểm đánh giá TB</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-gray-900">4.92</span>
            <span className="text-sm text-gray-500">/ 5.0</span>
          </div>
          <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
             <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
             Từ 3.420 đánh giá của Trekker
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-gray-500">Tỷ lệ an toàn & Cứu hộ</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-600 mb-3">99.85%</div>
          <div className="flex gap-4 text-xs font-medium text-gray-600">
             <span>0 sự cố nặng</span>
             <span>• 14 sơ cứu kịp thời</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm mb-4">
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-emerald-50 text-emerald-800 rounded-lg text-sm font-bold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Hồ sơ Ứng tuyển (Applications)
            <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full ml-1">12</span>
          </button>
          <button className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Leader Đang hoạt động (Active)
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full ml-1">48</span>
          </button>
        </div>
        <div className="text-xs font-semibold flex items-center gap-2 text-gray-600 pr-4">
           Cổng thẩm định tự động: <span className="text-emerald-600">BẬT</span>
           <div className="w-8 h-4 bg-emerald-500 rounded-full relative cursor-pointer">
              <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5"></div>
           </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            placeholder="Tìm theo tên, SĐT, CCCD, mã hồ sơ hoặc kinh nghiệm..."
          />
        </div>
        <select className="border border-gray-200 rounded-lg text-sm py-2.5 px-3 text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option>Tất cả giai đoạn thẩm định</option>
        </select>
        <select className="border border-gray-200 rounded-lg text-sm py-2.5 px-3 text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option>Tất cả địa bàn</option>
        </select>
        <button className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
          Mới cập nhật nhất
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
        </button>
      </div>

      {/* Table Header */}
      <div className="bg-gray-50 border border-gray-200 rounded-t-xl grid grid-cols-12 gap-4 p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
        <div className="col-span-5">Ứng viên & Chứng chỉ</div>
        <div className="col-span-2 text-center">Ngày nộp hồ sơ</div>
        <div className="col-span-2 text-center">Điểm bài thi</div>
        <div className="col-span-2">Giai đoạn xét duyệt</div>
        <div className="col-span-1 text-center">Thao tác</div>
      </div>

      {/* List */}
      <div className="bg-white border-x border-b border-gray-200 rounded-b-xl flex flex-col">
        {applicants.map((app, idx) => (
          <div key={app.id} className={`grid grid-cols-12 gap-4 p-5 items-center ${idx !== applicants.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-gray-50/50 transition-colors`}>
            {/* Applicant Info */}
            <div className="col-span-5 flex items-start gap-4">
              <div className="relative">
                <img src={app.avatar} alt={app.name} className="w-12 h-12 rounded-full object-cover shadow-sm border border-gray-200" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 text-[15px]">{app.name}</h3>
                  <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100">{app.id}</span>
                </div>
                <div className="text-sm text-gray-600 mb-2 font-medium flex items-center gap-2">
                   {app.phone} <span className="w-1 h-1 rounded-full bg-gray-300"></span> {app.email}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {app.cert && <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2 py-1 rounded-md border border-emerald-100">{app.cert}</span>}
                  {app.skills.map((skill, i) => (
                    <span key={i} className="bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-1 rounded-md border border-amber-100">{skill}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="col-span-2 text-center">
              <div className="font-semibold text-gray-900 text-sm mb-1">{app.date}</div>
              <div className="text-xs text-gray-500 mb-2">{app.time}</div>
              {app.priority && (
                <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-1 rounded border border-orange-100 uppercase">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Ưu tiên xử lý
                </span>
              )}
            </div>

            {/* Score */}
            <div className="col-span-2 text-center">
              {app.score ? (
                <div>
                  <div className="flex justify-center items-baseline gap-2 mb-1">
                    <span className="font-bold text-gray-900 text-sm">{app.score} điểm</span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${app.status === 'ĐẠT' || app.status === 'TUYỆT ĐỐI' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {app.percentage} {app.status}
                    </span>
                  </div>
                  <div className="w-24 mx-auto bg-gray-200 rounded-full h-1.5 mb-1">
                    <div className={`h-1.5 rounded-full ${app.status === 'TRƯỢT' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: app.percentage }}></div>
                  </div>
                  <div className="text-[10px] text-gray-500">{app.id === '#APPL-2024-042' ? 'Thi lúc: 24/10 08:15' : app.id === '#APPL-2024-039' ? 'Đã qua vòng lý thuyết' : app.id === '#APPL-2024-034' ? 'Chưa đạt điểm an toàn (min 24)' : 'Đặc cách phỏng vấn'}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-amber-600 text-xs font-bold mb-1">
                     <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     Đang làm bài trắc nghiệm
                  </div>
                  <div className="text-[10px] text-gray-500">Thời hạn nộp còn: 18h</div>
                </div>
              )}
            </div>

            {/* Stage */}
            <div className="col-span-2">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 
                  ${app.stage.includes('Phỏng vấn') ? 'bg-orange-50 border-orange-200 text-orange-600' 
                  : app.stage.includes('Quyết định') ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : app.stage.includes('Kiến thức') ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-red-50 border-red-200 text-red-600'}`}>
                  {app.stage.includes('Không') ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : (
                    <span className="font-bold text-sm">{app.stage.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm mb-1 leading-tight">{app.stage.substring(app.stage.indexOf('.') + 1).trim() || app.stage}</div>
                  <div className="text-[11px] text-gray-500 leading-tight">{app.stageNote}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="col-span-1 flex flex-col items-center gap-2">
              {app.actionType === 'primary' ? (
                <Link href={`/admin/leaders/${app.id.replace('#', '')}`} className="w-full text-center py-2 bg-[#1B5E41] hover:bg-[#144a33] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex justify-center items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {app.actionText}
                </Link>
              ) : app.actionType === 'secondary' ? (
                <button className="w-full text-center py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors flex justify-center items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {app.actionText}
                </button>
              ) : (
                <button className="w-full text-center py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg shadow-sm transition-colors">
                  {app.actionText}
                </button>
              )}
              <button className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-500">
          Hiển thị <span className="font-bold text-gray-900">1 - 5</span> trong tổng số <span className="font-bold text-gray-900">12</span> hồ sơ ứng tuyển
        </div>
        <div className="flex gap-1">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-400 cursor-not-allowed">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#1B5E41] text-white font-bold">1</button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold">2</button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold">3</button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};
