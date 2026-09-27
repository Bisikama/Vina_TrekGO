import React from 'react';

export const ReviewHeader = () => {
  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span>Chuyến đi của tôi</span>
          <span>&gt;</span>
          <span className="font-semibold text-gray-900">#TX-2411-8924</span>
          <span>&gt;</span>
          <span className="font-semibold text-gray-900">Đánh giá trải nghiệm sau hành trình</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Đánh Giá Trải Nghiệm Sau Chuyến Đi</h1>
        <p className="text-gray-500 text-sm">Phản hồi thực chiến của bạn giúp nâng chuẩn an toàn và ghi nhận đóng góp của đội ngũ dẫn đoàn.</p>
      </div>
      
      <div className="bg-green-100 text-green-800 text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 shrink-0 self-start md:self-auto border border-green-200">
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Tích lũy hoàn tất: +150 điểm VFRS
      </div>
    </div>
  );
};
