"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Destination } from "../types/destination.types";
import { destinationApi } from "../services/destination.api";
import { DestinationsTab } from "./tabs/DestinationsTab";
import { SystemTrailsTab } from "./tabs/SystemTrailsTab";
import { CheckpointsTab } from "./tabs/CheckpointsTab";

type ActiveTab = "destinations" | "trails" | "checkpoints";

export const DestinationManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("destinations");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    destinationApi
      .getDestinations({ pageSize: 100 })
      .then((res) => {
        if (!isCancelled) {
          setDestinations(res.items);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Lỗi khi tải danh sách địa danh chung:", err);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleViewTrails = (destId: string) => {
    setSelectedDestinationId(destId);
    setActiveTab("trails");
  };

  const handleViewCheckpoints = (destId: string) => {
    setSelectedDestinationId(destId);
    setActiveTab("checkpoints");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header chính */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1B5E41]"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E41]">
              Hệ thống Dữ liệu Cung đường
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
            Quản lý System-Trail & Địa danh
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Trung tâm điều phối toàn diện: Địa danh (Destinations) • Tuyến đường (Trails) • Trạm mốc (Checkpoints).
          </p>
        </div>

        {/* Quick info badges */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
            <span>📍 {destinations.length}</span>
            <span className="text-emerald-600 font-normal">Địa danh</span>
          </div>
        </div>
      </div>

      {/* Sub-tabs điều hướng */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("destinations")}
            className={`pb-4 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "destinations"
                ? "border-[#1B5E41] text-[#1B5E41]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <span>📍</span>
            <span>Địa danh (Destinations)</span>
          </button>

          <button
            onClick={() => setActiveTab("trails")}
            className={`pb-4 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "trails"
                ? "border-[#1B5E41] text-[#1B5E41]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <span>⛰️</span>
            <span>Cung đường hệ thống (System Trails)</span>
            {selectedDestinationId && activeTab === "trails" && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-normal">
                Đang lọc
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("checkpoints")}
            className={`pb-4 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "checkpoints"
                ? "border-[#1B5E41] text-[#1B5E41]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <span>🚩</span>
            <span>Trạm dừng chân & Checkpoints</span>
            {selectedDestinationId && activeTab === "checkpoints" && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-normal">
                Đang lọc
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Nội dung Tab */}
      <div>
        {activeTab === "destinations" && (
          <DestinationsTab
            onViewTrails={handleViewTrails}
            onViewCheckpoints={handleViewCheckpoints}
          />
        )}

        {activeTab === "trails" && (
          <SystemTrailsTab
            destinations={destinations}
            filterDestinationId={selectedDestinationId}
            onSelectDestination={setSelectedDestinationId}
          />
        )}

        {activeTab === "checkpoints" && (
          <CheckpointsTab
            destinations={destinations}
            filterDestinationId={selectedDestinationId}
            onSelectDestination={setSelectedDestinationId}
          />
        )}
      </div>
    </div>
  );
};
