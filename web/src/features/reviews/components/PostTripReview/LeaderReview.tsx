'use client';
import React, { useState } from 'react';

export const LeaderReview = () => {
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Tuyệt đối an toàn', 'Nhiệt tình & Thân thiện', 'Hỗ trợ thành viên yếu']);
  const [reviewText, setReviewText] = useState('');

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const getRatingText = (val: number) => {
    switch (val) {
      case 1: return '1/5 Tệ';
      case 2: return '2/5 Kém';
      case 3: return '3/5 Tạm';
      case 4: return '4/5 Tốt';
      case 5: return '5/5 Xuất sắc';
      default: return '0/5';
    }
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#1B4332]"></div>
      
      <div className="flex items-start gap-4 mb-6">
        <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center font-bold text-sm shrink-0">1</div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Đánh Giá Leader Hoàng Nam</h3>
          <p className="text-sm text-gray-500 mt-1">Đội ngũ trưởng đoàn chịu trách nhiệm cao nhất về an toàn thực địa và nhịp độ đoàn.</p>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8 ml-0 md:ml-12">
        <div className="w-full md:w-64 shrink-0 flex flex-col items-center bg-gray-50 rounded-xl p-6 border border-gray-100">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-3 relative border-4 border-white shadow-sm">
            <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=200&auto=format&fit=crop" className="object-cover w-full h-full" alt="Leader" />
            <div className="absolute bottom-0 right-0 bg-green-500 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
          <h4 className="font-bold text-gray-900 text-lg">Hoàng Nam</h4>
          <p className="text-[11px] text-gray-500 text-center mt-1">Senior Mountain Guide • 6 năm kinh nghiệm</p>
          
          <div className="grid grid-cols-2 gap-4 w-full mt-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="font-bold text-gray-900">48+</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Chuyến Tà Xùa</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900 flex justify-center items-center gap-1">4.96 <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></div>
              <div className="text-[10px] text-gray-500 mt-0.5">Đánh giá chung</div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-gray-400 flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Wilderness First Aid (WFA - IREC Certified)
          </div>
        </div>
        
        <div className="flex-1 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-4">
            <div>
              <div className="font-semibold text-gray-900 text-sm">Mức độ hài lòng với Leader Hoàng Nam</div>
              <div className="text-xs text-gray-500 mt-1">Chạm hoặc rê chuột để chấm điểm theo sao</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                {[1,2,3,4,5].map((star) => (
                  <svg 
                    key={star} 
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className={`w-6 h-6 cursor-pointer hover:scale-110 transition-transform ${star <= (hoveredRating || rating) ? 'text-yellow-400' : 'text-gray-300'}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="font-bold text-orange-500 text-sm w-28 text-right">{getRatingText(hoveredRating || rating)}</span>
            </div>
          </div>
          
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-3">Điểm nổi bật của Leader (Nhấp để chọn nhanh):</div>
            <div className="flex flex-wrap gap-2">
              {[
                'Tuyệt đối an toàn', 'Nhiệt tình & Thân thiện', 'Xử lý tình huống tốt',
                'Kiến thức rừng phong phú', 'Hỗ trợ thành viên yếu', 'Chụp ảnh đẹp có tâm', 'Nấu ăn ngon'
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
                  <svg className={`w-3.5 h-3.5 ${selectedTags.includes(tag) ? '' : 'text-transparent'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div className="text-sm font-semibold text-gray-900 mb-2">Lời nhắn gửi trực tiếp đến Leader Hoàng Nam:</div>
            <textarea 
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] min-h-[100px] resize-none"
              placeholder="Ví dụ: Anh Nam căn giờ dắt đoàn lên đón hoàng hôn ở Mỏm Lạc Đà cực kỳ chuẩn, luôn chú ý bước chân từng bạn leo dốc đứng..."
            ></textarea>
            <div className="flex justify-between items-center mt-1">
              <div className="text-[10px] text-gray-400">Tối thiểu 20 ký tự để cộng điểm thưởng chất lượng</div>
              <div className={`text-[10px] font-medium ${reviewText.length >= 20 ? 'text-green-600' : 'text-gray-400'}`}>
                {reviewText.length} ký tự
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
