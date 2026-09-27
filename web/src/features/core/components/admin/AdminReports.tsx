"use client";
import React, { useState } from 'react';

export const AdminReports = () => {
  const [timeFilter, setTimeFilter] = useState('30 ngày qua');
  const [regionFilter, setRegionFilter] = useState('Tất cả địa bàn');
  const [users, setUsers] = useState([
    { id: 9842, name: 'Hoàng Thu Trang', type: 'LEADER PRO', join: '14/03/2023', trips: 24, status: 'Active', typeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { id: 8819, name: 'Lê Mạnh Quân', type: 'Trekker Cấp 2', join: '22/01/2024', trips: 12, status: 'Active', typeClass: 'bg-gray-100 text-gray-800 border-gray-200' },
    { id: 7102, name: 'Trần Văn Tú', type: 'Trekker Mới', join: '05/09/2024', trips: 0, status: 'Inactive', typeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  ]);

  const handleDeleteUser = (id: number) => {
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-1">
            VỆ TINH ANALYTICS ENGINE • Cập nhật lúc 10:45 hôm nay
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Thống kê Toàn diện Hệ thống</h1>
          <p className="text-sm text-gray-500 mt-1">Phân tích số liệu vận hành, tăng trưởng, an toàn cung đường và hiệu suất trang thiết bị dã ngoại</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất dữ liệu CSV
          </button>
          <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Xuất báo cáo PDF
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center text-sm mb-6">
        <span className="font-medium text-gray-600">Khoảng thời gian:</span>
        <select 
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
        >
           <option>30 ngày qua (Đang chọn)</option>
           <option>Quý 3/2026</option>
           <option>Năm 2026</option>
        </select>
        <div className="w-px h-5 bg-gray-200 mx-2"></div>
        <span className="font-medium text-gray-600">Vùng núi:</span>
        <select 
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
        >
           <option>Tất cả địa bàn</option>
           <option>Tây Bắc</option>
           <option>Tây Nguyên</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
         {/* User stats overview mock */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 font-medium mb-1">TỔNG NGƯỜI DÙNG ĐĂNG KÝ</div>
            <div className="text-2xl font-bold text-gray-900 mb-2">24.850</div>
            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
               +4.2% so với tháng trước
            </div>
         </div>
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 font-medium mb-1">NGƯỜI DÙNG HOẠT ĐỘNG (MAU)</div>
            <div className="text-2xl font-bold text-gray-900 mb-2">16.420</div>
            <div className="text-xs text-gray-500 font-medium">
               Tỷ lệ hoạt động: <span className="text-gray-900 font-bold">66.1%</span>
            </div>
         </div>
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 font-medium mb-1">ĐỘI NGŨ MOUNTAIN LEADER</div>
            <div className="text-2xl font-bold text-gray-900 mb-2">450 <span className="text-sm font-normal text-gray-500">Leader</span></div>
            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
               +28 cấp mới
            </div>
         </div>
         <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 font-medium mb-1">TỶ LỆ QUAY LẠI (RETENTION)</div>
            <div className="text-2xl font-bold text-gray-900 mb-2">68.4%</div>
            <div className="text-xs text-gray-500 font-medium">
               &gt; 2 chuyến đi/năm
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-80 flex flex-col justify-center items-center text-gray-400">
          <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
          Biểu đồ Xu hướng Tăng trưởng Người dùng (Mock)
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-80 flex flex-col justify-center items-center text-gray-400">
          <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
          Biểu đồ Cơ cấu Phân loại Người dùng (Mock)
        </div>
      </div>
      
      {/* Danh sách người dùng mock */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
         <h3 className="text-lg font-bold text-gray-900 mb-4">Danh sách Chi tiết Người dùng & Đánh giá Hiệu suất</h3>
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
               <thead className="text-xs uppercase bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                     <th className="py-3 px-4 font-bold">Người dùng / Mã ID</th>
                     <th className="py-3 px-4 font-bold">Vai trò & Cấp bậc</th>
                     <th className="py-3 px-4 font-bold">Ngày đăng ký</th>
                     <th className="py-3 px-4 font-bold">Số chuyến đi</th>
                     <th className="py-3 px-4 font-bold">Trạng thái</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500 text-sm border-b">Không có dữ liệu người dùng nào</td>
                    </tr>
                  ) : users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                       <td className="py-3 px-4">
                          <div className="font-bold text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">ID: {user.id}</div>
                       </td>
                       <td className="py-3 px-4">
                          <span className={`${user.typeClass} text-[10px] font-bold px-2 py-0.5 rounded border`}>{user.type}</span>
                       </td>
                       <td className="py-3 px-4">{user.join}</td>
                       <td className="py-3 px-4 font-bold">{user.trips}</td>
                       <td className="py-3 px-4">
                          <span className={`flex items-center gap-1 font-medium text-xs ${user.status === 'Active' ? 'text-emerald-600' : 'text-gray-500'}`}>
                             <div className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></div> {user.status}
                          </span>
                       </td>
                       <td className="py-3 px-4">
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors text-xs font-bold"
                          >
                            Hủy kích hoạt
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
