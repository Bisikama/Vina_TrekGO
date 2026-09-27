import React from 'react';
import { MyRoutesHeader } from './MyRoutesHeader';
import { MyRoutesStats } from './MyRoutesStats';
import { MyRoutesFilters } from './MyRoutesFilters';
import { MyRouteCard } from './MyRouteCard';
import Link from 'next/link';

export const MyRoutesList = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <MyRoutesHeader />
      <MyRoutesStats />
      <MyRoutesFilters />
      
      <div className="space-y-6">
        {/* Card 1 */}
        <MyRouteCard 
          image="https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=600&auto=format&fit=crop"
          altitude="3.049m"
          hdop="HDOP < 1.5"
          waypoints="1.420 Waypoints"
          statusBadge={
            <span className="bg-[#1B4332] text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Đã kiểm định (Verified VFRS)
            </span>
          }
          privacyBadge={
            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Công khai trên Trekking System
            </span>
          }
          title="Tuyến Khảo Sát Đỉnh Pu Ta Leng - Đi Qua Rừng Hoa Đỗ Quyên Cổ Thụ"
          location="Tam Đường, Lai Châu (Miền Bắc)"
          difficulty="Thử thách (Level 4)"
          distance="28.5 km"
          elevation="+1.820m"
          checkpoints="8 Checkpoints"
          tracklogStatus={
            <div className="font-semibold text-green-600 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              GPX Chuẩn HDOP &lt; 1.5
            </div>
          }
          tags={[
            "2 nguồn nước tự nhiên ổn định",
            "1 lán nghỉ qua đêm tại mốc 2.400m",
            "Sóng Viettel chập chờn từ mốc 2.600m"
          ]}
          code="TRK-PTL-004"
          updatedAt="14/11/2024 (2 ngày trước)"
          actions={
            <>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded flex items-center gap-1.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Xem chi tiết
              </button>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded flex items-center gap-1.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Chỉnh sửa
              </button>
              <button className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
              </button>
            </>
          }
        />
        
        {/* Card 2 */}
        <MyRouteCard 
          image="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600&auto=format&fit=crop"
          altitude="2.402m"
          hdop="Phân tích độ dốc"
          waypoints="920 Waypoints"
          statusBadge={
            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Chờ kiểm định (Pending Verification)
            </span>
          }
          privacyBadge={
            <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Dự kiến phản hồi trước 18/11/2024
            </span>
          }
          title="Sống Lưng Khủng Long Chiêu Lầu Thi - Cung Vòng Cung Trà Shan Tuyết"
          location="Hoàng Su Phì, Hà Giang"
          difficulty="Trung bình (Level 2)"
          distance="16.2 km"
          elevation="+980m"
          checkpoints="5 Checkpoints"
          tracklogStatus={
            <div className="font-semibold text-amber-600 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              File GPX đã tải lên
            </div>
          }
          tags={[
            "3 điểm check-in sống lưng khủng long",
            "1 trạm kiểm lâm cửa rừng",
            "1 mỏm săn mây cao độ 2.300m"
          ]}
          code="TRK-CLT-019"
          updatedAt="10/11/2024"
          actions={
            <>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded flex items-center gap-1.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Xem hồ sơ duyệt
              </button>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded flex items-center gap-1.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Chỉnh sửa
              </button>
              <button className="px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-xs font-bold rounded flex items-center gap-1.5 transition-colors border border-gray-200">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Hủy yêu cầu duyệt
              </button>
              <button className="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </>
          }
        />
        
        {/* Card 3 */}
        <MyRouteCard 
          image="https://images.unsplash.com/photo-1518182170546-076616fd46be?q=80&w=600&auto=format&fit=crop"
          altitude="1.750m"
          waypoints="350 Waypoints"
          statusBadge={
            <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Cá nhân / Chưa kiểm định (Personal/Unverified)
            </span>
          }
          privacyBadge={
            <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              Chỉ mình bạn xem được
            </span>
          }
          title="Cung Trekking Rừng Ma Anh Hùng - Hồ Trên Núi Bidoup Dã Ngoại"
          location="Lạc Dương, Lâm Đồng (Tây Nguyên)"
          difficulty="Nhẹ nhàng (Level 1)"
          distance="12.0 km"
          elevation="+450m"
          checkpoints="4 Checkpoints"
          tracklogStatus={
            <div className="font-semibold text-gray-500 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              Chưa đồng bộ tracklog chi tiết
            </div>
          }
          tags={[
            "1 điểm hạ trại bên hồ nước",
            "1 thác nước nhỏ",
            "2 trạm SOS sóng yếu dưới thung lũng"
          ]}
          code="TRK-BDP-003"
          updatedAt="05/11/2024"
          actions={
            <>
              <Link href="/routes/1/publish" className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#153426] text-white text-xs font-bold rounded flex items-center gap-1.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Yêu cầu duyệt (Request Publish)
              </Link>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded flex items-center gap-1.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Chỉnh sửa
              </button>
              <button className="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </>
          }
        />
        
        {/* Card 4 */}
        <MyRouteCard 
          image="https://images.unsplash.com/photo-1541315585098-958a2d3e9112?q=80&w=600&auto=format&fit=crop"
          altitude="Độ dốc > 45°"
          hdop="Nguy cơ sạt trượt"
          waypoints="410 Waypoints"
          statusBadge={
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Bị từ chối (Rejected)
            </span>
          }
          privacyBadge={null}
          title="Đường Mòn Vách Đá Trắng Hà Giang Tuyến Cũ (Lối Ven Hẻm Tu Sản)"
          location="Mèo Vạc, Hà Giang"
          difficulty="Cực kỳ nguy hiểm (Level 5)"
          distance="8.5 km"
          elevation="+620m"
          checkpoints="3 Checkpoints"
          tracklogStatus={
            <div className="font-semibold text-red-600 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Không có lan can bảo hộ
            </div>
          }
          tags={[]}
          code="TRK-VDT-009"
          updatedAt="28/10/2024"
          errorBox={
            <div>
              <span className="font-bold">Lý do từ chối kiểm duyệt VFRS:</span>
              <p className="mt-0.5">Tuyến có nguy cơ sạt trượt nghiêm trọng vào mùa <strong>mưa</strong>, hiện không có lan can trợ lực ở mốc km 4.2. Cần bổ sung phương án thoát hiểm khẩn cấp và sơ đồ hỗ trợ y tế trước khi nộp lại.</p>
            </div>
          }
          actions={
            <>
              <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded flex items-center gap-1.5 transition-colors shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Xem lý do từ chối & Sửa
              </button>
              <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded flex items-center gap-1.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Chỉnh sửa
              </button>
              <button className="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </>
          }
        />
      </div>
    </div>
  );
};
