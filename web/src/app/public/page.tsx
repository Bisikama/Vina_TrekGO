"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth";
import { listPublicTrips } from "@/features/trips/services/public-trips.api";

export default function PublicLandingPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const openLogin = () => {
    router.push("/public/login");
  };

  const openRegister = () => {
    router.push("/public/register");
  };

  const [featuredTrails, setFeaturedTrails] = useState([
    {
      id: "t-1",
      title: "Bạch Mộc Lương Tử (Kỳ Quan San)",
      location: "Lào Cai - Lai Châu",
      elevation: "3,046m",
      distance: "30 km",
      duration: "3 Ngày 2 Đêm",
      difficulty: "Khó / Thử thách",
      difficultyType: "hard",
      price: "3.450.000đ",
      image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
      rating: 4.9,
    },
    {
      id: "t-2",
      title: "Sống Lưng Khủng Long Tà Xùa",
      location: "Sơn La",
      elevation: "2,865m",
      distance: "18.4 km",
      duration: "2 Ngày 1 Đêm",
      difficulty: "Trung bình",
      difficultyType: "medium",
      price: "2.190.000đ",
      image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
      rating: 4.8,
    },
    {
      id: "t-3",
      title: "Chinh Phục Đỉnh Fansipan",
      location: "Sa Pa, Lào Cai",
      elevation: "3,143m",
      distance: "24 km",
      duration: "2 Ngày 1 Đêm",
      difficulty: "Khó / Thử thách",
      difficultyType: "hard",
      price: "2.850.000đ",
      image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
      rating: 4.95,
    },
    {
      id: "t-4",
      title: "Trekking Thác Lát - Tà Năng Phan Dũng",
      location: "Lâm Đồng - Bình Thuận",
      elevation: "1,100m",
      distance: "55 km",
      duration: "3 Ngày 2 Đêm",
      difficulty: "Trung bình",
      difficultyType: "medium",
      price: "2.600.000đ",
      image: "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80",
      rating: 4.75,
    },
  ]);

  useEffect(() => {
    const loadTrips = async () => {
      try {
        const data = await listPublicTrips({ page: 1, pageSize: 4 });
        if (data && data.length > 0) {
          const images = [
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80",
          ];
          
          const mapped = data.map((trip, index) => {
            const start = new Date(trip.startAt);
            const end = new Date(trip.endAt);
            const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            
            return {
              id: trip.id,
              title: trip.title,
              location: "Việt Nam", 
              elevation: "Cập nhật sau",
              distance: "Cập nhật sau",
              duration: `${diffDays} Ngày`,
              difficulty: "Trung bình",
              difficultyType: "medium",
              price: trip.price ? `${Number(trip.price).toLocaleString('vi-VN')}đ` : "Liên hệ",
              image: images[index % images.length],
              rating: 5.0,
            };
          });
          setFeaturedTrails(mapped);
        }
      } catch (err) {
        console.error("Failed to load public trips", err);
      }
    };
    loadTrips();
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#1F2937] flex flex-col selection:bg-[#2F6B4F] selection:text-white">
      {/* 🟢 TOP ALERT / SOS BANNER */}
      <div className="bg-[#FEF2F2] border-b border-red-200 py-2 px-4 text-xs font-medium text-[#991B1B] flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
            </span>
            <span>
              <strong>Hệ thống Giám sát & Cứu hộ SOS 24/7:</strong> Tín hiệu GPS định vị trực tiếp & Đội cứu hộ túc trực trên tất cả các tuyến chính.
            </span>
          </div>
          <span className="hidden md:inline-block text-[11px] bg-red-100 px-2 py-0.5 rounded text-red-800 font-semibold">
            Độ an toàn: 100% Verified
          </span>
        </div>
      </div>

      {/* 🟢 NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E5E7EB] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
              alt="VinaTrekGO"
              width={48}
              height={48}
              className="h-10 w-10 rounded-xl object-cover shadow-md"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-[#125238]">
                VinaTrek<span className="text-[#F59E0B]">GO</span>
              </span>
              <span className="text-[10px] font-semibold text-[#6B7280] tracking-wider uppercase -mt-1">
                Field-Ready Trekking Portal
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#1F2937]">
            <a href="#hero" className="text-[#2F6B4F] font-semibold hover:text-[#1F4A36] transition">
              Trang Chủ
            </a>
            <a href="#trails" className="hover:text-[#2F6B4F] transition">
              Cung Đường Trek
            </a>
            <a href="#gear" className="hover:text-[#2F6B4F] transition">
              Trang Bị Trekking
            </a>
            <a href="#safety" className="hover:text-[#2F6B4F] transition">
              Cứu Hộ SOS
            </a>
            <a href="#community" className="hover:text-[#2F6B4F] transition">
              Cộng Đồng
            </a>
          </nav>

          {/* Auth Action Buttons */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 bg-[#F8F9FF] p-1.5 pl-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-xs font-semibold text-[#1F2937]">
                  {user.name}
                </span>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md shadow transition cursor-pointer"
                >
                  Đăng Xuất
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={openLogin}
                  className="px-4 py-2 text-sm font-semibold text-[#1F2937] hover:text-[#2F6B4F] bg-white border border-[#E5E7EB] hover:border-[#2F6B4F] rounded-lg transition cursor-pointer shadow-xs"
                >
                  Đăng Nhập
                </button>
                <button
                  onClick={openRegister}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#2F6B4F] hover:bg-[#1F4A36] rounded-lg shadow-md transition cursor-pointer"
                >
                  Đăng Ký
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 🟢 HERO SECTION WITH USER UPLOADED BACKGROUND IMAGE */}
      <section id="hero" className="relative min-h-[580px] lg:min-h-[640px] flex items-center overflow-hidden">
        {/* Hero Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-trekking.jpg"
            alt="VinaTrekGO Trekking Highlight"
            fill
            priority
            className="object-cover object-center transform scale-105 transition-transform duration-1000"
          />
          {/* Subtle gradient overlay to make text high contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/35" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-white w-full">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-medium mb-4 border border-white/30">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse"></span>
              Cổng Đặt Tour & Cứu Hộ Trekking Hàng Đầu
            </span>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight drop-shadow-md">
              Chinh Phục Những Đỉnh Núi Hùng Vĩ Nhất Việt Nam
            </h1>

            <p className="mt-4 text-base sm:text-lg text-gray-200 leading-relaxed max-w-xl">
              Đồng hành cùng đội ngũ Porter bản địa, chuẩn hóa trang thiết bị chuyên nghiệp và mạng lưới giám sát GPS an toàn từng bước chân.
            </p>

            {/* Quick Hero CTAs */}
            <div className="mt-8 flex flex-wrap gap-4 items-center">
              <a
                href="#trails"
                className="px-6 py-3.5 bg-[#2F6B4F] hover:bg-[#1F4A36] text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
              >
                <span>Khám Phá Cung Đường</span>
                <span>➔</span>
              </a>
              {!isAuthenticated && (
                <button
                  onClick={openRegister}
                  className="px-6 py-3.5 bg-[#F59E0B] hover:bg-[#855300] text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Gia Nhập Ngay</span>
                </button>
              )}
            </div>

            {/* Telemetry quick metrics */}
            <div className="mt-10 grid grid-cols-3 gap-4 pt-6 border-t border-white/20 max-w-lg">
              <div>
                <p className="text-2xl lg:text-3xl font-black text-[#FEA619] tabular-nums">50+</p>
                <p className="text-xs text-gray-300 font-medium">Tuyến Đã Kiểm Định</p>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-white tabular-nums">12,000+</p>
                <p className="text-xs text-gray-300 font-medium">Trekker Tham Gia</p>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-[#AEE9C6] tabular-nums">100%</p>
                <p className="text-xs text-gray-300 font-medium">Giám Sát GPS 24/7</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🟢 FEATURED TRAILS SECTION */}
      <section id="trails" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#2F6B4F] bg-[#DCFCE7] px-3 py-1 rounded-full">
              Hành Trình Tiêu Biểu
            </span>
            <h2 className="text-3xl font-bold text-[#1F2937] mt-3">
              Những Cung Đường Đang Hot
            </h2>
            <p className="text-sm text-[#6B7280] mt-1">
              Đã được cấp phép an toàn & tích hợp dịch vụ porter dẫn đường
            </p>
          </div>
          <button className="mt-4 md:mt-0 text-sm font-bold text-[#2F6B4F] hover:underline flex items-center gap-1 cursor-pointer">
            Xem Tất Cả ➔
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredTrails.map((trail) => (
            <div
              key={trail.id}
              className="bg-white rounded-xl overflow-hidden border border-[#E5E7EB] shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group"
            >
              {/* Thumbnail */}
              <div className="relative h-48 w-full overflow-hidden bg-gray-200">
                <img
                  src={trail.image}
                  alt={trail.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {/* Difficulty Chip */}
                <div className="absolute top-3 right-3">
                  {trail.difficultyType === "hard" ? (
                    <span className="bg-[#FEE2E2] text-[#991B1B] text-xs font-bold px-2.5 py-1 rounded-full border border-red-200">
                      {trail.difficulty}
                    </span>
                  ) : (
                    <span className="bg-[#FEF3C7] text-[#92400E] text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                      {trail.difficulty}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-semibold px-2 py-0.5 rounded">
                  {trail.rating}
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#6B7280]">
                    {trail.location}
                  </span>
                  <h3 className="text-base font-bold text-[#1F2937] mt-1 group-hover:text-[#2F6B4F] transition">
                    {trail.title}
                  </h3>
                </div>

                {/* Telemetry metadata row */}
                <div className="my-4 pt-3 border-t border-[#E5E7EB] grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-[#1F2937]">
                  <div className="bg-[#F7F7F4] p-1.5 rounded border border-gray-100">
                    <span className="block text-gray-400">Độ cao</span>
                    <span className="tabular-nums font-bold text-[#2F6B4F]">{trail.elevation}</span>
                  </div>
                  <div className="bg-[#F7F7F4] p-1.5 rounded border border-gray-100">
                    <span className="block text-gray-400">Quãng đường</span>
                    <span className="tabular-nums font-bold text-[#1F2937]">{trail.distance}</span>
                  </div>
                  <div className="bg-[#F7F7F4] p-1.5 rounded border border-gray-100">
                    <span className="block text-gray-400">Thời gian</span>
                    <span className="font-bold text-[#855300]">{trail.duration}</span>
                  </div>
                </div>

                {/* Price & Book */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Trọn gói từ</span>
                    <span className="text-lg font-black text-[#2F6B4F] tabular-nums">{trail.price}</span>
                  </div>
                  <button
                    onClick={openLogin}
                    className="px-3.5 py-2 bg-[#2F6B4F] hover:bg-[#1F4A36] text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-xs"
                  >
                    Đặt Tour
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 🟢 GEAR RENTAL & UTILITY SECTION */}
      <section id="gear" className="py-16 bg-white border-y border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="flex flex-col">
              <span className="inline-flex self-start text-xs font-bold uppercase tracking-wider text-[#855300] bg-[#FEF3C7] px-3 py-1 rounded-full">
                Dịch Vụ Đi Kèm
              </span>
              <h2 className="text-3xl font-extrabold text-[#1F2937] mt-3">
                Trang Bị Trekking Chuẩn Tác Chiến
              </h2>
              <p className="mt-3 text-sm text-[#6B7280] leading-relaxed lg:w-[calc(200%+3rem)] lg:max-w-none">
                Không cần bỏ ra hàng chục triệu sắm sửa thiết bị. VinaTrekGO cung cấp đầy đủ lều trại chống nước, gậy trekking carbon, túi ngủ giữ nhiệt, đèn pin siêu sáng và bộ đàm định vị.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3 p-3 bg-[#F7F7F4] rounded-lg border border-[#E5E7EB]">
                  <div>
                    <h4 className="text-sm font-bold text-[#1F2937]">Lều Trại 2-4 Người Chịu Gió Bão</h4>
                    <p className="text-xs text-[#6B7280]">Kháng nước 3,000mm, trọng lượng nhẹ chuẩn outdoor chuyên nghiệp.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#F7F7F4] rounded-lg border border-[#E5E7EB]">
                  <div>
                    <h4 className="text-sm font-bold text-[#1F2937]">Balo Trekking Chợ Lực 45L-65L</h4>
                    <p className="text-xs text-[#6B7280]">Đệm lưng thoáng khí, đai hông phân bổ lực tối ưu.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#F7F7F4] rounded-lg border border-[#E5E7EB]">
                  <div>
                    <h4 className="text-sm font-bold text-[#1F2937]">Bộ Đàm VHF & Đèn Đầu SOS</h4>
                    <p className="text-xs text-[#6B7280]">Kết nối liên tục với Trạm điều hành cứu hộ rừng quốc gia.</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={openLogin}
                  className="px-6 py-3 bg-[#2F6B4F] hover:bg-[#1F4A36] text-white font-bold text-sm rounded-xl shadow-md transition cursor-pointer"
                >
                  Xem Trang Bị Ngay ➔
                </button>
              </div>
            </div>

            {/* Feature visual grid */}
            <div className="grid grid-cols-2 gap-4 lg:mt-[130px] lg:h-[210px]">
              <div className="p-6 bg-[#F8F9FF] rounded-2xl border border-[#E5E7EB] text-center shadow-xs">
                <h4 className="font-bold text-[#1F2937] text-sm">Porter Bản Địa</h4>
                <p className="text-xs text-[#6B7280] mt-1">Thông thuộc từng vách đá, am hiểu thời tiết vùng cao.</p>
              </div>
              <div className="p-6 bg-[#F8F9FF] rounded-2xl border border-[#E5E7EB] text-center shadow-xs">
                <h4 className="font-bold text-[#1F2937] text-sm">Ăn Uống Nóng Nổi</h4>
                <p className="text-xs text-[#6B7280] mt-1">Thực đơn đầy đủ calo, gà nướng lợn bản giữa rừng.</p>
              </div>
              <div className="p-6 bg-[#F8F9FF] rounded-2xl border border-[#E5E7EB] text-center shadow-xs">
                <h4 className="font-bold text-[#1F2937] text-sm">Y Tế & Bảo Hiểm</h4>
                <p className="text-xs text-[#6B7280] mt-1">Bảo hiểm du lịch mạo hiểm tối đa 100.000.000đ/vụ.</p>
              </div>
              <div className="p-6 bg-[#F8F9FF] rounded-2xl border border-[#E5E7EB] text-center shadow-xs">
                <h4 className="font-bold text-[#1F2937] text-sm">Chụp Ảnh Săn Mây</h4>
                <p className="text-xs text-[#6B7280] mt-1">Hỗ trợ nhiếp ảnh gia ghi lại những khoảnh khắc để đời.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🟢 SAFETY & SOS ASSURANCE BANNER */}
      <section id="safety" className="py-16 bg-[#125238] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <span className="bg-white/20 text-[#AEE9C6] text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-white/20">
            Cam Kết An Toàn
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-4">
            An Toàn Là Ưu Tiên Số 1 Tại VinaTrekGO
          </h2>
          <p className="mt-4 text-sm sm:text-base text-gray-200 leading-relaxed">
            Mỗi đoàn trekking đều được trang bị thiết bị phát tín hiệu SOS vệ tinh, họp kỹ thuật trước chuyến đi và kiểm tra sức khỏe đầu nguồn. Chúng tôi đảm bảo trải nghiệm trọn vẹn nhất cho bạn.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            {!isAuthenticated && (
              <button
                onClick={openRegister}
                className="px-6 py-3 bg-[#F59E0B] hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-lg transition cursor-pointer"
              >
                Đăng Ký Tài Khoản Ngay
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 🟢 FOOTER */}
      <footer className="bg-[#121C2A] text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image
                src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
                alt="VinaTrekGO"
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-cover"
              />
              <span className="font-extrabold text-xl text-white">VinaTrekGO</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Cổng thông tin, hệ thống đặt tour và trung tâm hỗ trợ cứu hộ trekking hàng đầu Việt Nam.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Cung Đường HOT</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#trails" className="hover:text-white transition">Bạch Mộc Lương Tử</a></li>
              <li><a href="#trails" className="hover:text-white transition">Tà Xùa Sơn La</a></li>
              <li><a href="#trails" className="hover:text-white transition">Đỉnh Fansipan Sapa</a></li>
              <li><a href="#trails" className="hover:text-white transition">Tà Năng Phan Dũng</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Về VinaTrekGO</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#" className="hover:text-white transition">Giới thiệu dự án</a></li>
              <li><a href="#" className="hover:text-white transition">Quy chuẩn an toàn</a></li>
              <li><a href="#" className="hover:text-white transition">Mạng lưới Porter</a></li>
              <li><a href="#" className="hover:text-white transition">Liên hệ cứu hộ 24/7</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Tài Khoản & Thành Viên</h4>
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Đăng ký thành viên để nhận mã giảm giá 15% cho chuyến đi đầu tiên.</p>
              <div className="flex gap-2">
                <button
                  onClick={openLogin}
                  className="px-3 py-1.5 bg-[#2F6B4F] text-white text-xs font-bold rounded hover:bg-[#1F4A36] transition cursor-pointer"
                >
                  Đăng Nhập
                </button>
                <button
                  onClick={openRegister}
                  className="px-3 py-1.5 bg-[#F59E0B] text-white text-xs font-bold rounded hover:bg-amber-600 transition cursor-pointer"
                >
                  Đăng Ký
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
          © 2026 VinaTrekGO Portal. All rights reserved. Designed according to DESIGN.md specs.
        </div>
      </footer>
    </div>
  );
}
