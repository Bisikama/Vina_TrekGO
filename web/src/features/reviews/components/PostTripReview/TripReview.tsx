'use client';
import React, { useState } from 'react';

export const TripReview = () => {
  const [rating1, setRating1] = useState(5);
  const [hover1, setHover1] = useState(0);
  
  const [rating2, setRating2] = useState(5);
  const [hover2, setHover2] = useState(0);
  
  const [rating3, setRating3] = useState(5);
  const [hover3, setHover3] = useState(0);

  const [selectedTags, setSelectedTags] = useState<string[]>(['Cung đường ngoạn mục', 'Săn mây thành công', 'Bữa ăn đầy đặn ấm nóng']);
  const [reviewText, setReviewText] = useState('');

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
      
      <div className="flex items-start gap-4 mb-6">
        <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center font-bold text-sm shrink-0">2</div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Đánh Giá Toàn Diện Chuyến Đi</h3>
          <p className="text-sm text-gray-500 mt-1">Chất lượng cung đường thực tế, phương tiện di chuyển và chất lượng hậu cần cắm trại.</p>
        </div>
      </div>
      
      <div className="ml-0 md:ml-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-blue-100 p-1.5 rounded text-blue-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-xs">Cảnh quan & Cung đường</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Độ ngoạn mục, địa hình</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {[1,2,3,4,5].map((star) => (
                  <svg 
                    key={star} 
                    onClick={() => setRating1(star)}
                    onMouseEnter={() => setHover1(star)}
                    onMouseLeave={() => setHover1(0)}
                    className={`w-4 h-4 cursor-pointer transition-colors ${star <= (hover1 || rating1) ? 'text-yellow-400' : 'text-gray-300'}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="font-bold text-orange-500 text-sm">{(hover1 || rating1).toFixed(1)} / 5</span>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-purple-100 p-1.5 rounded text-purple-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-xs">Công tác tổ chức & Xe</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Đúng giờ, ăn nghỉ, hậu cần</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {[1,2,3,4,5].map((star) => (
                  <svg 
                    key={star} 
                    onClick={() => setRating2(star)}
                    onMouseEnter={() => setHover2(star)}
                    onMouseLeave={() => setHover2(0)}
                    className={`w-4 h-4 cursor-pointer transition-colors ${star <= (hover2 || rating2) ? 'text-yellow-400' : 'text-gray-300'}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="font-bold text-orange-500 text-sm">{(hover2 || rating2).toFixed(1)} / 5</span>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-green-100 p-1.5 rounded text-green-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-xs">Giá trị so với chi phí</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Tính trọn gói, độ xứng đáng</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {[1,2,3,4,5].map((star) => (
                  <svg 
                    key={star} 
                    onClick={() => setRating3(star)}
                    onMouseEnter={() => setHover3(star)}
                    onMouseLeave={() => setHover3(0)}
                    className={`w-4 h-4 cursor-pointer transition-colors ${star <= (hover3 || rating3) ? 'text-yellow-400' : 'text-gray-300'}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="font-bold text-orange-500 text-sm">{(hover3 || rating3).toFixed(1)} / 5</span>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">Thẻ cảm nhận hành trình:</div>
          <div className="flex flex-wrap gap-2">
            {[
              'Cung đường ngoạn mục', 'Săn mây thành công', 'Xe Limousine êm ái',
              'Bữa ăn đầy đặn ấm nóng', 'Lịch trình hợp lý', 'Porter bản địa tận tụy'
            ].map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm ${
                  selectedTags.includes(tag) 
                  ? 'bg-[#1B4332] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg className={`w-3 h-3 ${selectedTags.includes(tag) ? '' : 'text-transparent'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {selectedTags.includes(tag) ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  )}
                </svg>
                {tag}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <div className="text-sm font-semibold text-gray-900 mb-2">Nhận xét chi tiết về hành trình:</div>
          <textarea 
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] min-h-[100px] resize-none"
            placeholder="Chia sẻ kinh nghiệm chuẩn bị thể lực, cảnh quan đoạn sống lưng, điểm cắm trại đêm có lộng gió không..."
          ></textarea>
        </div>
      </div>
    </div>
  );
};
