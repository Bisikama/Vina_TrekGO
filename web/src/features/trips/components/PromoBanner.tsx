import Image from "next/image";
import Link from "next/link";

export const PromoBanner = () => {
  return (
    <div className="relative rounded-3xl overflow-hidden mb-12 h-64 md:h-80 shadow-lg">
      <Image 
        src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop" 
        alt="Sống Lưng Khủng Long" 
        fill
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#181F25] via-[#181F25]/80 to-transparent"></div>
      
      <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-amber-400 text-black px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Đón khách tháng 11</span>
          <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-3 2.5-4.5 1 1 3 2 3 5 0 1-1 2-2 2s-1 1-1 2c0 1 1 2 2 2z" /></svg>
            Chỉ còn 2 suất cuối
          </span>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4 max-w-lg tracking-tight">
          Chinh Phục Sống Lưng Khủng Long Tà Xùa
        </h2>
        
        <p className="text-gray-300 text-[13px] md:text-sm max-w-md mb-8 leading-relaxed font-medium">
          Đón bình minh trên biển mây cuồn cuộn ở độ cao 2.865m. Chương trình trekking được trang bị trạm hỗ trợ y tế thực địa và bảo hiểm chuyên dụng lên tới 100.000.000đ.
        </p>
        
        <div className="flex flex-wrap gap-3">
          <Link href="#" className="bg-[#154B36] hover:bg-[#0D3425] text-white px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2">
            Khám phá ngay
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
          <Link href="#" className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Tìm hiểu chương trình Leader WFA
          </Link>
        </div>

        {/* Carousel indicators mock */}
        <div className="absolute bottom-6 left-8 md:left-12 flex gap-1.5">
          <div className="w-6 h-1.5 rounded-full bg-white"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
        </div>
      </div>
    </div>
  );
};
