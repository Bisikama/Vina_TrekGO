import Image from "next/image";

export function ExploreHero() {
  return (
    <div className="bg-[#1B5E41] py-16 px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <Image 
          src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1920&q=80" 
          alt="Mountains" 
          fill 
          className="object-cover"
        />
      </div>
      <div className="max-w-7xl mx-auto relative z-10 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
          Khám phá Cung đường Hệ thống
        </h1>
        <p className="text-[#A7F3D0] text-lg max-w-2xl mx-auto">
          Mở khóa các bản đồ chuẩn, điểm check-in và dữ liệu địa hình độc quyền để tổ chức chuyến đi an toàn cùng bạn bè.
        </p>
      </div>
    </div>
  );
}
