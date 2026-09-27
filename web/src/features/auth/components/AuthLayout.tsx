"use client";

import React from "react";
import { AuthBrandingHero } from "./AuthBrandingHero";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-[#154B36] selection:text-white">
      {/* Left Side Branding Hero - 50% width on large screens */}
      <div className="hidden lg:flex lg:w-1/2 relative h-screen sticky top-0 bg-[#0F172A]">
        <AuthBrandingHero />
      </div>

      {/* Right Side Form Content - 50% width on large screens */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center bg-white overflow-y-auto">
        <div className="w-full h-full px-6 py-12 sm:px-12 md:px-16 lg:px-20 xl:px-28 2xl:px-36 flex items-center justify-center">
          <div className="w-full max-w-[480px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

