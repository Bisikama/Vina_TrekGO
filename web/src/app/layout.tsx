import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VinaTrekGO - Cổng Thông Tin & Cổng Cứu Hộ Trekking Việt Nam",
  description: "Khám phá các cung đường trekking hùng vĩ nhất Việt Nam. Hệ thống đặt tour, thuê thiết bị chuyên nghiệp và hỗ trợ cứu hộ SOS 24/7.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${inter.variable} scroll-smooth antialiased`}>
      <body className="min-h-screen flex flex-col font-sans bg-[#F7F7F4] text-[#1F2937]">
        {children}
      </body>
    </html>
  );
}
