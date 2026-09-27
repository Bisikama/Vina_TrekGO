'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegistrationHeader } from './RegistrationHeader';
import { ExperienceSection } from './ExperienceSection';
import { CertificateSection } from './CertificateSection';
import { DocumentSection } from './DocumentSection';
import { PersonalInfoSection } from './PersonalInfoSection';
import { SidebarBenefits } from './SidebarBenefits';
import Link from 'next/link';

export const RegistrationLayout = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  return (
    <div className="bg-[#F7F7F4] min-h-screen pt-20 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-900 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Trang chủ
          </Link>
          <span>/</span>
          <Link href="#" className="hover:text-gray-900">Trở thành Leader</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Hồ sơ ứng tuyển Leader cấp 1</span>
        </div>

        <RegistrationHeader currentStep={currentStep} isReady={isReady} />

        <div className="flex flex-col lg:flex-row gap-8 mt-8">
          <div className="flex-1">
            {currentStep === 1 && <PersonalInfoSection />}
            {currentStep === 2 && (
              <>
                <ExperienceSection />
                <CertificateSection />
              </>
            )}
            {currentStep === 3 && (
              <DocumentSection onUploadComplete={() => setIsReady(true)} isUploaded={isReady} />
            )}
          </div>
          <div className="w-full lg:w-[320px] shrink-0">
            <div className="sticky top-24">
              <SidebarBenefits />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-gray-200 stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-[#1B4332] stroke-current" strokeWidth="3" strokeDasharray={currentStep === 1 ? "25, 100" : currentStep === 2 ? "50, 100" : isReady ? "100, 100" : "75, 100"} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#1B4332]">
                {currentStep === 1 ? '25%' : currentStep === 2 ? '50%' : isReady ? '100%' : '75%'}
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">Đã hoàn thành {currentStep === 1 ? '1/4' : currentStep === 2 ? '2/4' : isReady ? '4/4' : '3/4'} bước</div>
              <div className="text-[10px] text-gray-500 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                Đã lưu nháp tự động 2 phút trước
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              Lưu bản nháp
            </button>
            {currentStep > 1 && (
              <button 
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Quay lại bước {currentStep - 1}
              </button>
            )}
            
            {currentStep < 3 ? (
              <button 
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-6 py-2.5 bg-[#1B4332] text-white rounded-lg text-sm font-bold shadow-sm hover:bg-[#153426] transition-colors flex items-center gap-2"
              >
                Tiếp tục
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            ) : (
              <div className="relative group">
                <button 
                  onClick={() => {
                    if (isReady) {
                      router.push('/leader-registration/test');
                    }
                  }}
                  className={`px-6 py-2.5 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors ${isReady ? 'bg-[#1B4332] hover:bg-[#153426] cursor-pointer' : 'bg-[#4B5563] cursor-not-allowed opacity-90'}`}
                >
                  Xem lại & Gửi hồ sơ
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
                {!isReady && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-gray-900 text-white text-xs p-2 rounded shadow-lg hidden group-hover:block text-center z-50">
                    Vui lòng tải lên CCCD mặt sau trước khi chuyển sang bước Xem lại & Gửi duyệt.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
