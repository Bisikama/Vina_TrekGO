"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  StepTwoOverviewMap,
  type SystemTrailDetail,
} from "./StepTwoOverviewMap";

import {
  useLeaderTrailSuggestions,
  useLeaderTripDetail,
  useLeaderTripMutations,
  useLeaderTripOptions,
} from "../../hooks";
import type { LeaderCheckpointOption, TrailSuggestion } from "../../types";

export function LeaderCreateTripStepTwo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripIdFromParam = searchParams.get("tripId");

  const [tripId, setTripId] = useState<string | null>(null);

  useEffect(() => {
    if (tripIdFromParam) {
      setTripId(tripIdFromParam);
    } else if (typeof window !== "undefined") {
      const savedId = window.sessionStorage.getItem("leader-create-trip-id");
      if (savedId) setTripId(savedId);
    }
  }, [tripIdFromParam]);

  const { trip, isLoading: isLoadingTrip, refetch: refetchTrip } = useLeaderTripDetail({
    tripId,
  });
  const { suggestions, isLoading: isLoadingSuggestions } = useLeaderTrailSuggestions({
    tripId,
  });
  const { fetchCheckpoints } = useLeaderTripOptions();
  const {
    setCheckpoints: apiSetCheckpoints,
    setTrails: apiSetTrails,
    isSubmitting,
  } = useLeaderTripMutations();

  const [destinationCheckpoints, setDestinationCheckpoints] = useState<LeaderCheckpointOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [trailDetail, setTrailDetail] = useState<SystemTrailDetail | null>(null);

  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createCustomRoute, setCreateCustomRoute] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  // Load destination checkpoints when trip is loaded
  useEffect(() => {
    if (trip?.destinationId) {
      fetchCheckpoints(trip.destinationId).then((cps) => {
        setDestinationCheckpoints(cps);
      });
    }
  }, [trip?.destinationId, fetchCheckpoints]);

  // Sync selected trail from suggestions or trip (ưu tiên cung đường có checkpoint hợp lệ)
  useEffect(() => {
    if (trip?.trails && trip.trails.length > 0) {
      setSelectedRouteId(trip.trails[0].systemTrailId);
    } else if (suggestions.length > 0 && !selectedRouteId) {
      const firstValid = suggestions.find((s) => s.checkpointIds && s.checkpointIds.length > 0);
      setSelectedRouteId((firstValid ?? suggestions[0]).id);
    }
  }, [trip?.trails, suggestions, selectedRouteId]);

  const selectedTrailSuggestion = useMemo(() => {
    const firstValid = suggestions.find((s) => s.checkpointIds && s.checkpointIds.length > 0);
    return (
      suggestions.find((s) => s.id === selectedRouteId) ??
      firstValid ??
      suggestions[0] ??
      null
    );
  }, [suggestions, selectedRouteId]);

  // Tự động lấy danh sách checkpoint theo thứ tự của cung đường đã chọn
  const currentCheckpoints = useMemo(() => {
    if (selectedTrailSuggestion && selectedTrailSuggestion.checkpointIds?.length > 0) {
      const trailCps = selectedTrailSuggestion.checkpointIds;
      return destinationCheckpoints
        .filter((cp) => trailCps.includes(cp.id))
        .sort((a, b) => trailCps.indexOf(a.id) - trailCps.indexOf(b.id));
    }
    return [];
  }, [selectedTrailSuggestion, destinationCheckpoints]);

  function selectRoute(routeId: string) {
    setSelectedRouteId(routeId);
    const suggestion = suggestions.find((s) => s.id === routeId);
    if (suggestion) {
      window.sessionStorage.setItem(
        "leader-create-trip-route",
        JSON.stringify({
          id: suggestion.id,
          code: suggestion.id,
          name: suggestion.name,
          location: trip?.destinationId || "Điểm đến đã chọn",
          distance: `${suggestion.distanceKm} km`,
          completionRate: "95%",
          duration: "1–2 ngày",
          difficulty: suggestion.difficulty,
          imageUrl:
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=80",
        })
      );
    }
  }

  async function handleSaveDraft() {
    if (!tripId || !trip) return;
    setErrorMsg("");

    try {
      let currentVersion = trip.version;
      const checkpointIdsToSave = currentCheckpoints.map((cp) => cp.id);
      if (checkpointIdsToSave.length > 0) {
        const cpRes = await apiSetCheckpoints(tripId, {
          expectedVersion: currentVersion,
          checkpointIds: checkpointIdsToSave,
        });
        currentVersion = cpRes.version;
      }
      if (selectedRouteId) {
        await apiSetTrails(tripId, {
          expectedVersion: currentVersion,
          trailIds: [selectedRouteId],
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      refetchTrip();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể lưu bản nháp.");
    }
  }

  async function handleContinue() {
    if (!tripId || !trip) {
      router.push("/leader/create-trip");
      return;
    }

    const checkpointIdsToSave = currentCheckpoints.map((cp) => cp.id);
    if (checkpointIdsToSave.length === 0) {
      setErrorMsg("Cung đường chưa có checkpoint nào.");
      return;
    }

    if (!selectedRouteId) {
      setErrorMsg("Vui lòng chọn cung đường System Trail cho chuyến đi.");
      return;
    }

    setErrorMsg("");

    try {
      let currentVersion = trip.version;

      const cpRes = await apiSetCheckpoints(tripId, {
        expectedVersion: currentVersion,
        checkpointIds: checkpointIdsToSave,
      });
      currentVersion = cpRes.version;

      await apiSetTrails(tripId, {
        expectedVersion: currentVersion,
        trailIds: [selectedRouteId],
      });

      // Save summary in session storage for Step 3
      if (selectedTrailSuggestion) {
        window.sessionStorage.setItem(
          "leader-create-trip-route",
          JSON.stringify({
            id: selectedTrailSuggestion.id,
            code: selectedTrailSuggestion.id,
            name: selectedTrailSuggestion.name,
            location: "Khu vực điểm đến",
            distance: `${selectedTrailSuggestion.distanceKm} km`,
            completionRate: "95%",
            duration: "1–2 ngày",
            difficulty: selectedTrailSuggestion.difficulty,
            imageUrl:
              "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=80",
          })
        );
      }

      router.push(`/leader/create-trip/review?tripId=${tripId}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Đã xảy ra lỗi khi lưu cung đường.");
    }
  }

  const filteredSuggestions = useMemo(() => {
    if (!searchKeyword.trim()) return suggestions;
    const kw = searchKeyword.toLowerCase();
    return suggestions.filter(
      (s) => s.name.toLowerCase().includes(kw) || s.difficulty.toLowerCase().includes(kw)
    );
  }, [suggestions, searchKeyword]);

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Quản lý dẫn đoàn
              <span className="mx-2">›</span>
              Tạo chuyến đi mới
              <span className="mx-2">›</span>
              <strong className="text-[#125238]">
                Bước 2: Cung đường &amp; Trạm dừng
              </strong>
            </div>

            <div className="flex gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#125238]">
                BƯỚC 2/3
              </span>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveDraft}
                className="rounded-xl bg-[#eef3fb] px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                {isSubmitting ? "Đang lưu..." : "▣ Lưu nháp"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-3xl font-bold text-slate-950">
              Thiết lập Cung đường &amp; Trạm dừng
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Chọn cung đường đã xác minh và thiết lập các checkpoint an toàn
              cho đoàn {trip ? `• ${trip.title}` : ""}.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => router.push("/leader/create-trip")}
              className="rounded-xl bg-emerald-50 p-4 text-left text-[#125238]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#125238] font-bold text-white">
                  ✓
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">Bước 1</p>
                  <strong className="text-sm">Thông tin cơ bản</strong>
                  <p className="text-xs text-emerald-700">Đã hoàn thành</p>
                </div>
              </div>
            </button>

            <div className="rounded-xl bg-[#eef3fb] p-4 text-[#125238]">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f6b4f] font-bold text-white">
                  2
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">
                    Bước 2 đang thực hiện
                  </p>
                  <strong className="text-sm">Cung đường &amp; Trạm dừng</strong>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-bold">
                  3
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">Bước 3</p>
                  <strong className="text-sm">Xem lại &amp; Công khai</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong className="font-bold">Lỗi: </strong>
            {errorMsg}
          </div>
        )}

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-950">
                  1. Lựa chọn Cung đường cho Chuyến đi (System Trails)
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Sử dụng kho dữ liệu GPS đã thẩm định và xác minh theo chuẩn VFRS.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-1">
                <button
                  type="button"
                  className="rounded-xl border border-[#2f6b4f] bg-emerald-50 p-4 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-4 border-[#125238]" />

                    <strong className="text-sm text-slate-900">
                      Cung đường đã thẩm định
                    </strong>

                    <span className="ml-auto rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-[#125238]">
                      VFRS Verified
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Dữ liệu trắc diện, nguồn nước và tọa độ cứu hộ đã được chuẩn hóa.
                  </p>
                </button>
              </div>


                  <label className="mt-5 flex h-12 items-center gap-3 rounded-xl bg-[#eef3fb] px-4">
                    <span>⌕</span>

                    <input
                      className="w-full bg-transparent text-sm outline-none"
                      placeholder="Tìm cung đường, cấp độ khó..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                    />
                  </label>

                  <div className="mt-5 space-y-3">
                    {isLoadingSuggestions ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                        Đang tải danh sách cung đường đề xuất từ hệ thống...
                      </div>
                    ) : filteredSuggestions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                        Không tìm thấy cung đường khả dụng cho điểm đến này.
                      </div>
                    ) : (
                      filteredSuggestions.map((suggestion) => {
                        const selected = selectedRouteId === suggestion.id;

                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => selectRoute(suggestion.id)}
                            className={`flex w-full flex-col gap-4 rounded-xl border p-4 text-left transition sm:flex-row ${
                              selected
                                ? "border-[#2f6b4f] bg-emerald-50 shadow-sm"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div
                              className="h-28 w-full shrink-0 rounded-lg bg-cover bg-center sm:w-44"
                              style={{
                                backgroundImage: `url("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=80")`,
                              }}
                            >
                              <span className="m-2 inline-flex rounded bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white">
                                #{suggestion.id.slice(0, 8)}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-slate-950">
                                      {suggestion.name}
                                    </h3>
                                    {(!suggestion.checkpointIds || suggestion.checkpointIds.length === 0) && (
                                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                        Chưa gắn Checkpoint
                                      </span>
                                    )}
                                  </div>

                                  <p className="mt-1 text-xs text-slate-500">
                                    ⌖ Đi qua {suggestion.checkpointIds?.length || 0} checkpoint
                                  </p>
                                </div>

                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                    selected
                                      ? "bg-[#125238] text-white"
                                      : "bg-slate-200 text-transparent"
                                  }`}
                                >
                                  ✓
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-3 gap-2">
                                <div>
                                  <span className="text-[10px] text-slate-400">
                                    Cự ly
                                  </span>
                                  <strong className="block text-xs">
                                    {suggestion.distanceKm} km
                                  </strong>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-400">
                                    Độ dốc/Cao độ
                                  </span>
                                  <strong className="block text-xs">
                                    {suggestion.elevationGainM ? `+${suggestion.elevationGainM}m` : "Chuẩn"}
                                  </strong>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-400">
                                    Độ khó
                                  </span>
                                  <strong className="block text-xs">
                                    {suggestion.difficulty}
                                  </strong>
                                </div>
                              </div>

                              <span className="mt-3 inline-flex rounded bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-800">
                                {suggestion.difficulty}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-950">
                      2. Trạm dừng &amp; Checkpoints An toàn
                    </h2>

                    <span className="rounded-full bg-[#125238] px-2.5 py-1 text-[10px] font-bold text-white">
                      {currentCheckpoints.length} MỐC BẮT BUỘC
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Danh sách các mốc kiểm soát đoàn bắt buộc theo thứ tự hành trình của cung đường.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {destinationCheckpoints.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Đang tải danh sách checkpoint của điểm đến...
                  </div>
                ) : currentCheckpoints.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    Cung đường đã chọn chưa có trạm dừng nào.
                  </div>
                ) : (
                  currentCheckpoints.map((checkpoint, idx) => (
                    <article
                      key={checkpoint.id}
                      className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 transition"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#125238] font-bold text-white">
                          {idx + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-950">
                            {checkpoint.name}
                          </h3>

                          <p className="mt-1 text-xs text-slate-600">
                            {checkpoint.description || "Mốc kiểm soát vệ tinh an toàn"}
                          </p>

                          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                            <div>
                              <span className="text-slate-400">Tọa độ: </span>
                              <strong className="text-slate-800">
                                {Number(checkpoint.latitude).toFixed(4)}, {Number(checkpoint.longitude).toFixed(4)}
                              </strong>
                            </div>

                            <div>
                              <span className="text-slate-400">Bán kính quét: </span>
                              <strong className="text-slate-800">
                                {checkpoint.defaultRadiusMeters || 50}m
                              </strong>
                            </div>
                          </div>
                        </div>

                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-[#125238]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#125238]" />
                          Bắt buộc
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="sticky top-20 hidden space-y-5 xl:block">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-950">
                  {selectedTrailSuggestion
                    ? `Tổng quan ${selectedTrailSuggestion.name}`
                    : "Tổng quan cung đường"}
                </h2>

                <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">
                  {trailDetail?.elevationGainM
                    ? `${trailDetail.elevationGainM}m Peak`
                    : "GPS Verified"}
                </span>
              </div>

              {/* Bản đồ MapLibre 3D Terrain gọi API Backend */}
              <StepTwoOverviewMap
                trailCode={selectedRouteId || "TRAIL_BADEN_COTDIEN"}
                onTrailLoaded={(detail) => setTrailDetail(detail)}
              />

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">Tổng cự ly</span>
                  <strong className="block text-sm">
                    {trailDetail?.distanceKm
                      ? `${trailDetail.distanceKm} km`
                      : selectedTrailSuggestion
                      ? `${selectedTrailSuggestion.distanceKm} km`
                      : "--"}
                  </strong>
                </div>

                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">
                    Độ cao đỉnh
                  </span>
                  <strong className="block text-sm text-red-600">
                    {trailDetail?.elevationGainM
                      ? `${trailDetail.elevationGainM}m`
                      : selectedTrailSuggestion?.elevationGainM
                      ? `${selectedTrailSuggestion.elevationGainM}m`
                      : "--"}
                  </strong>
                </div>

                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">Độ khó</span>
                  <strong className="block text-sm text-orange-600">
                    {trailDetail?.difficulty
                      ? trailDetail.difficulty
                      : selectedTrailSuggestion?.difficulty
                      ? selectedTrailSuggestion.difficulty
                      : "--"}
                  </strong>
                </div>

                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">
                    Trạm bắt buộc
                  </span>
                  <strong className="block text-sm">
                    {currentCheckpoints.length} mốc
                  </strong>
                </div>

                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">Thời gian</span>
                  <strong className="block text-sm">
                    {trailDetail?.estimatedDurationMinutes
                      ? `~${Math.round(
                          trailDetail.estimatedDurationMinutes / 60,
                        )} giờ`
                      : "~5 giờ"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-950">
                Quy chuẩn An toàn Trạm dừng VFRS
              </h2>

              <div className="mt-4 space-y-4 text-xs leading-5 text-slate-600">
                <p>
                  ⚠ <strong>Mốc kiểm soát bắt buộc:</strong> Toàn đoàn
                  phải quét GPS và đồng bộ trạng thái tại mỗi checkpoint đã định.
                </p>

                <p>
                  ◉ <strong>Định vị khẩn cấp SOS:</strong> Hệ thống kích hoạt
                  giám sát thời gian thực khi bắt đầu chuyến đi.
                </p>

                <p>
                  ☎ Cứu hộ phản ứng nhanh VFRS:{" "}
                  <strong className="text-red-600">1800-9988</strong>
                </p>
              </div>
            </section>
          </aside>
        </div>

        <footer className="sticky bottom-0 z-30 mt-6 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => router.push("/leader/create-trip")}
            className="h-11 rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            ← Quay lại Bước 1
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveDraft}
              className="h-11 rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              {isSubmitting ? "Đang lưu..." : "Lưu bản nháp"}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleContinue}
              className="h-11 rounded-xl bg-[#125238] px-6 text-sm font-bold text-white shadow-sm hover:bg-[#2f6b4f] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Đang xử lý..." : "Tiếp tục: Xem lại & Công khai →"}
            </button>
          </div>
        </footer>
      </div>

      {saved && (
        <div className="fixed bottom-24 right-6 z-[80] rounded-xl bg-[#125238] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ Đã lưu bản nháp cung đường và trạm dừng.
        </div>
      )}
    </main>
  );
}
