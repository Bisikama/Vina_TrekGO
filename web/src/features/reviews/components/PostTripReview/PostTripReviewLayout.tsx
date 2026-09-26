'use client';
import React, { useState } from 'react';
import { ReviewHeader } from './ReviewHeader';
import { TripSummaryBanner } from './TripSummaryBanner';
import { LeaderReview } from './LeaderReview';
import { TripReview } from './TripReview';
import { EquipmentReview } from './EquipmentReview';
import { MediaUpload } from './MediaUpload';

export const PostTripReviewLayout = () => {
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmit = () => {
    setShowSuccessModal(true);
  };

  return (
    <div className="bg-[#F7F7F4] min-h-screen pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ReviewHeader />
        <TripSummaryBanner />
        
        <LeaderReview />
        <TripReview />
        <EquipmentReview />
        <MediaUpload />
        
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" defaultChecked className="w-4 h-4 text-[#1B4332] rounded focus:ring-[#1B4332] cursor-pointer" />
            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
              Đồng ý hiển thị tên của tôi công khai trên trang chi tiết chuyến đi
            </span>
          </label>
          
          <button 
            onClick={handleSubmit}
            className="w-full md:w-auto bg-[#1B4332] text-white font-bold py-3.5 px-8 rounded-xl hover:bg-[#153426] shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            Gửi Đánh Giá & Nhận 150 Điểm
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-gradient-to-br from-[#1B4332] to-[#153426] pt-12 pb-8 px-6 text-center relative">
              <button onClick={() => setShowSuccessModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-2">Cảm ơn bạn!</h3>
              <p className="text-white/90 text-sm">Đánh giá của bạn đã được ghi nhận.</p>
            </div>
            <div className="p-8 bg-white text-center">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6">
                <div className="text-orange-500 font-bold text-lg mb-1">+150 Trek Point</div>
                <div className="text-sm text-gray-600">Đã cộng vào quỹ điểm thưởng của bạn</div>
              </div>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                Những chia sẻ của bạn sẽ giúp cộng đồng Trekker có thêm thông tin hữu ích và giúp đội ngũ Vina TrekGO ngày càng hoàn thiện hơn.
              </p>
              <button 
                onClick={() => {
                  setShowSuccessModal(false);
                  window.location.href = '/routes';
                }}
                className="w-full bg-[#1B4332] hover:bg-[#153426] text-white font-bold py-3.5 px-6 rounded-xl transition-colors shadow-sm"
              >
                Về trang cá nhân
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
