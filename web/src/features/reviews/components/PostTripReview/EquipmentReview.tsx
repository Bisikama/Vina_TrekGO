'use client';
import React, { useState } from 'react';

export const EquipmentReview = () => {
  const [rating1, setRating1] = useState(5);
  const [hover1, setHover1] = useState(0);
  const [tags1, setTags1] = useState<string[]>(['Khung chắc chắn chống gió', 'Sạch sẽ không mùi']);
  
  const [rating2, setRating2] = useState(5);
  const [hover2, setHover2] = useState(0);
  const [tags2, setTags2] = useState<string[]>(['Nhẹ trợ lực tốt', 'Khóa FlickLock chắc']);
  
  const [reviewText, setReviewText] = useState('');

  const toggleTag = (tags: string[], setTags: React.Dispatch<React.SetStateAction<string[]>>, tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#1B4332]"></div>
      
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center font-bold text-sm shrink-0">3</div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Đánh Giá Thiết Bị Thuê Tại Kho</h3>
            <p className="text-sm text-gray-500 mt-1">Đơn thuê #RT-2411-9820 bàn giao tại điểm đón xe Hà Nội</p>
          </div>
        </div>
        <div className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded border border-gray-200">
          Đã miễn đặt cọc 100%
        </div>
      </div>
      
      <div className="ml-0 md:ml-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Item 1 */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                <img src="https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=100&auto=format&fit=crop" className="w-full h-full object-cover" alt="Lều" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] text-gray-500 uppercase font-bold">NH-CL2-8941</div>
                  <div className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">Lều 2 người</div>
                </div>
                <h4 className="font-bold text-gray-900 text-sm">Lều 2 lớp Naturehike Cloud Up 2</h4>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((star) => (
                      <svg 
                        key={star} 
                        onClick={() => setRating1(star)}
                        onMouseEnter={() => setHover1(star)}
                        onMouseLeave={() => setHover1(0)}
                        className={`w-3.5 h-3.5 cursor-pointer transition-colors ${star <= (hover1 || rating1) ? 'text-yellow-400' : 'text-gray-300'}`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="font-bold text-gray-900 text-xs">{(hover1 || rating1).toFixed(1)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['Khung chắc chắn chống gió', 'Sạch sẽ không mùi', 'Khóa kéo trơn tru', 'Chống mưa tốt'].map((tag) => (
                <span 
                  key={tag}
                  onClick={() => toggleTag(tags1, setTags1, tag)}
                  className={`text-[10px] px-2 py-1 rounded cursor-pointer transition-colors ${
                    tags1.includes(tag) ? 'bg-[#1B4332] text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          {/* Item 2 */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                <img src="https://images.unsplash.com/photo-1515444744559-7be63e1600de?q=80&w=100&auto=format&fit=crop" className="w-full h-full object-cover" alt="Gậy" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] text-gray-500 uppercase font-bold">BD-TRP-2019</div>
                  <div className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">Cặp 2 cây</div>
                </div>
                <h4 className="font-bold text-gray-900 text-sm">Gậy Carbon Black Diamond Trail Pro</h4>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((star) => (
                      <svg 
                        key={star} 
                        onClick={() => setRating2(star)}
                        onMouseEnter={() => setHover2(star)}
                        onMouseLeave={() => setHover2(0)}
                        className={`w-3.5 h-3.5 cursor-pointer transition-colors ${star <= (hover2 || rating2) ? 'text-yellow-400' : 'text-gray-300'}`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="font-bold text-gray-900 text-xs">{(hover2 || rating2).toFixed(1)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['Nhẹ trợ lực tốt', 'Khóa FlickLock chắc', 'Đầu gậy bám đá'].map((tag) => (
                <span 
                  key={tag}
                  onClick={() => toggleTag(tags2, setTags2, tag)}
                  className={`text-[10px] px-2 py-1 rounded cursor-pointer transition-colors ${
                    tags2.includes(tag) ? 'bg-[#1B4332] text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          {/* Add more items if needed */}
        </div>
        
        <div>
          <div className="text-sm font-semibold text-gray-900 mb-2">Nhận xét quy trình bàn giao & vệ sinh đồ kho:</div>
          <textarea 
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] min-h-[80px] resize-none"
            placeholder="Đồ nhận trước giờ xe chạy được kiểm tra kỹ, có dán tem test pin Fenix đầy đủ..."
          ></textarea>
        </div>
      </div>
    </div>
  );
};
