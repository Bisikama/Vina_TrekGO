"use client";

import { useMemo, useState } from "react";

type TaskType = "delivery" | "recovery";

type TaskStatus =
  | "pending"
  | "delivering"
  | "recovery"
  | "completed"
  | "warning";

type TaskFilter =
  | "all"
  | "delivery"
  | "recovery"
  | "completed";

type DeliveryTask = {
  id: string;
  bookingId: string;
  customer: string;
  phone: string;
  trip: string;
  location: string;
  time: string;
  equipment: string;
  type: TaskType;
  status: TaskStatus;
  priority?: boolean;
  note: string;
};

const initialTasks: DeliveryTask[] = [
  {
    id: "task-001",
    bookingId: "BK-7892",
    customer: "Nguyễn Văn An",
    phone: "0901 234 567",
    trip: "Fansipan 2N1Đ",
    location: "Sảnh Cổng Trạm Tôn",
    time: "06:00 - 06:20",
    equipment: "04 bộ thiết bị",
    type: "delivery",
    status: "pending",
    priority: true,
    note: "Khách cần nhận đủ thiết bị trước giờ đoàn xuất phát.",
  },
  {
    id: "task-002",
    bookingId: "BK-8014",
    customer: "Trần Mai Chi",
    phone: "0938 456 210",
    trip: "Lào Thẩn săn mây",
    location: "Sa Pa Hub HQ",
    time: "07:15 - 07:30",
    equipment: "03 bộ thiết bị",
    type: "delivery",
    status: "delivering",
    note: "Bàn giao tại quầy số 02 và kiểm tra giấy tờ.",
  },
  {
    id: "task-003",
    bookingId: "BK-7612",
    customer: "Lê Hoàng Nam",
    phone: "0977 880 212",
    trip: "Fansipan 3N2Đ",
    location: "Điểm đón xe bản Sín Chải",
    time: "Dự kiến 14:30",
    equipment: "06 thiết bị và lều",
    type: "recovery",
    status: "recovery",
    note: "Kiểm tra tình trạng lều và đèn pin tại chỗ.",
  },
  {
    id: "task-004",
    bookingId: "BK-7955",
    customer: "Bùi Đức Long",
    phone: "0912 663 988",
    trip: "Tả Liên Sơn",
    location: "Bến xe trung tâm Sa Pa",
    time: "08:10 - 08:30",
    equipment: "02 bộ thiết bị",
    type: "delivery",
    status: "warning",
    priority: true,
    note: "Không liên lạc được với khách sau 3 lần gọi.",
  },
  {
    id: "task-005",
    bookingId: "BK-7551",
    customer: "Phạm Thanh Hà",
    phone: "0987 001 456",
    trip: "Nhìu Cồ San",
    location: "Sa Pa Hub HQ",
    time: "Hoàn tất lúc 09:10",
    equipment: "04 thiết bị",
    type: "delivery",
    status: "completed",
    note: "Đã ký biên bản và chụp ảnh bàn giao.",
  },
];

const statusConfig: Record<
  TaskStatus,
  {
    label: string;
    badge: string;
    border: string;
    accent: string;
  }
> = {
  pending: {
    label: "Chờ tiếp nhận",
    badge: "bg-amber-100 text-amber-800",
    border: "border-amber-200",
    accent: "bg-amber-500",
  },
  delivering: {
    label: "Đang giao",
    badge: "bg-blue-100 text-blue-800",
    border: "border-blue-200",
    accent: "bg-blue-600",
  },
  recovery: {
    label: "Chờ thu hồi",
    badge: "bg-violet-100 text-violet-800",
    border: "border-violet-200",
    accent: "bg-violet-600",
  },
  completed: {
    label: "Đã hoàn tất",
    badge: "bg-emerald-100 text-emerald-800",
    border: "border-emerald-200",
    accent: "bg-emerald-600",
  },
  warning: {
    label: "Cần xử lý",
    badge: "bg-red-100 text-red-800",
    border: "border-red-200",
    accent: "bg-red-600",
  },
};

const filters: {
  value: TaskFilter;
  label: string;
  count: number;
}[] = [
  {
    value: "all",
    label: "Tất cả",
    count: 14,
  },
  {
    value: "delivery",
    label: "Giao thiết bị",
    count: 5,
  },
  {
    value: "recovery",
    label: "Thu hồi",
    count: 4,
  },
  {
    value: "completed",
    label: "Đã xong",
    count: 5,
  },
];

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "location"
    | "clock"
    | "box"
    | "phone"
    | "route"
    | "check"
    | "search"
    | "refresh"
    | "alert"
    | "user";
  className?: string;
}) {
  const paths = {
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    box: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7" />
        <path d="M12 11v10" />
      </>
    ),
    phone: (
      <path d="M5 4h4l2 5-3 2c1.5 3 2.5 4 5 5l2-3 5 2v4c0 1-1 2-2 2C10 20 4 14 3 6c0-1 1-2 2-2Z" />
    ),
    route: (
      <>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M18 12a7 7 0 0 0-12-5L4 9" />
        <path d="M6 12a7 7 0 0 0 12 5l2-2" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 3 20h18L12 3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function TaskInformation({
  icon,
  label,
  value,
}: {
  icon: "location" | "clock" | "box" | "phone";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        name={icon}
        className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
      />

      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-sm font-semibold text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onAdvance,
}: {
  task: DeliveryTask;
  onAdvance: (task: DeliveryTask) => void;
}) {
  const config = statusConfig[task.status];

  const actionLabel =
    task.status === "pending"
      ? "Bắt đầu bàn giao"
      : task.status === "delivering"
        ? "Xác nhận đã giao"
        : task.status === "recovery"
          ? "Bắt đầu thu hồi"
          : task.status === "warning"
            ? "Báo điều phối"
            : "Xem biên nhận";

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${config.border}`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1.5 ${config.accent}`}
      />

      <div className="p-5 pl-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                #{task.bookingId}
              </span>

              {task.priority ? (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-red-700">
                  Ưu tiên
                </span>
              ) : null}
            </div>

            <h3 className="mt-2 text-lg font-extrabold text-slate-950">
              {task.customer}
            </h3>

            <p className="mt-1 text-sm font-semibold text-[#0d5b3a]">
              {task.trip}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${config.badge}`}
          >
            {config.label}
          </span>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <TaskInformation
            icon="location"
            label="Điểm thực hiện"
            value={task.location}
          />

          <TaskInformation
            icon="clock"
            label="Khung giờ"
            value={task.time}
          />

          <TaskInformation
            icon="box"
            label="Thiết bị"
            value={task.equipment}
          />

          <TaskInformation
            icon="phone"
            label="Liên hệ"
            value={task.phone}
          />
        </div>

        <div
          className={`mt-4 flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm ${
            task.status === "warning"
              ? "bg-red-50 text-red-800"
              : "bg-[#f1f7f3] text-[#315c48]"
          }`}
        >
          <Icon
            name={
              task.status === "warning"
                ? "alert"
                : "check"
            }
            className="mt-0.5 h-4 w-4 shrink-0"
          />

          <p>{task.note}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {task.status !== "completed" ? (
            <button
              type="button"
              onClick={() =>
                window.alert(
                  `Đã mở chỉ đường đến ${task.location} cho đơn ${task.bookingId}.`,
                )
              }
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-[#0d5b3a] hover:text-[#0d5b3a]"
            >
              <Icon
                name="route"
                className="h-4 w-4"
              />
              Chỉ đường
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onAdvance(task)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition ${
              task.status === "warning"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#0d5b3a] hover:bg-[#09472d]"
            }`}
          >
            <Icon
              name={
                task.status === "warning"
                  ? "alert"
                  : "check"
              }
              className="h-4 w-4"
            />

            {actionLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

export function StaffDeliveryTaskList() {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeFilter, setActiveFilter] =
    useState<TaskFilter>("all");
  const [search, setSearch] = useState("");

  const visibleTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "delivery" &&
          task.type === "delivery" &&
          task.status !== "completed") ||
        (activeFilter === "recovery" &&
          task.type === "recovery" &&
          task.status !== "completed") ||
        (activeFilter === "completed" &&
          task.status === "completed");

      const searchableText = [
        task.bookingId,
        task.customer,
        task.phone,
        task.trip,
        task.location,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesFilter &&
        (!keyword || searchableText.includes(keyword))
      );
    });
  }, [activeFilter, search, tasks]);

  function advanceTask(task: DeliveryTask) {
    if (task.status === "warning") {
      window.alert(
        `Đã gửi báo cáo đơn ${task.bookingId} cho điều phối viên.`,
      );

      return;
    }

    if (task.status === "completed") {
      window.alert(
        `Biên nhận điện tử của đơn ${task.bookingId} đã sẵn sàng.`,
      );

      return;
    }

    const nextStatus: TaskStatus =
      task.status === "pending"
        ? "delivering"
        : "completed";

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: nextStatus,
              time:
                nextStatus === "completed"
                  ? "Vừa hoàn tất"
                  : item.time,
            }
          : item,
      ),
    );
  }

  return (
    <main className="min-h-full bg-[#f4f7fd] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="text-xs font-medium text-slate-500">
          Giao nhận thực địa
          <span className="mx-2">›</span>
          Nhiệm vụ hôm nay
        </div>

        <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-950">
                Nhiệm vụ hôm nay
              </h1>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                GPS ON
              </span>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800">
                OFFLINE READY
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Theo dõi các lượt giao, thu hồi và xác nhận
              bàn giao thiết bị trong ca làm việc.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              window.alert(
                "Dữ liệu nhiệm vụ mock đã được đồng bộ.",
              )
            }
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-[#0d5b3a] hover:text-[#0d5b3a]"
          >
            <Icon
              name="refresh"
              className="h-4 w-4"
            />
            Đồng bộ nhiệm vụ
          </button>
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-2xl bg-gradient-to-br from-[#123f2d] to-[#0d5b3a] p-5 text-white shadow-sm">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                  <Icon
                    name="user"
                    className="h-7 w-7"
                  />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
                    Nhân viên giao nhận
                  </p>

                  <h2 className="mt-1 text-xl font-extrabold">
                    Hoàng Văn Tuấn
                  </h2>

                  <p className="mt-1 text-sm text-emerald-100">
                    Hub Sa Pa · Đang trực tuyến
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white/10 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-100">
                  Tiến độ ca làm
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-2xl font-black">
                    100%
                  </span>

                  <span className="pb-1 text-xs text-emerald-100">
                    đã đồng bộ
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Ca làm việc hiện tại
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-xl bg-[#eaf5ee] p-3 text-[#0d5b3a]">
                <Icon
                  name="clock"
                  className="h-6 w-6"
                />
              </div>

              <div>
                <p className="text-xl font-black text-slate-950">
                  06:00 - 14:00
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Điểm điều phối: Sa Pa Hub HQ
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Chờ tiếp nhận",
              value: "02",
              detail: "Cần xử lý trước 07:00",
              color: "text-amber-700",
              background: "bg-amber-50",
            },
            {
              label: "Đang giao trên tuyến",
              value: "03",
              detail: "Tất cả đang đúng giờ",
              color: "text-blue-700",
              background: "bg-blue-50",
            },
            {
              label: "Chờ thu hồi",
              value: "04",
              detail: "Bắt đầu từ 14:30",
              color: "text-violet-700",
              background: "bg-violet-50",
            },
            {
              label: "Đã hoàn tất",
              value: "05",
              detail: "Không có sự cố",
              color: "text-emerald-700",
              background: "bg-emerald-50",
            },
          ].map((stat) => (
            <article
              key={stat.label}
              className={`rounded-2xl border border-white p-5 shadow-sm ${stat.background}`}
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">
                {stat.label}
              </p>

              <p
                className={`mt-3 text-3xl font-black ${stat.color}`}
              >
                {stat.value}
              </p>

              <p className="mt-2 text-xs font-medium text-slate-500">
                {stat.detail}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const active =
                  activeFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() =>
                      setActiveFilter(filter.value)
                    }
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                      active
                        ? "bg-[#0d5b3a] text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {filter.label}

                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-white text-slate-500"
                      }`}
                    >
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="relative block w-full xl:max-w-sm">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Tìm mã đơn, khách hàng, địa điểm..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0d5b3a] focus:bg-white focus:ring-2 focus:ring-[#0d5b3a]/10"
              />
            </label>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">
              Danh sách nhiệm vụ
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Hiển thị {visibleTasks.length} nhiệm vụ mẫu
              phù hợp.
            </p>
          </div>

          <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Cập nhật vừa xong
          </div>
        </div>

        {visibleTasks.length > 0 ? (
          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            {visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onAdvance={advanceTask}
              />
            ))}
          </section>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <h3 className="font-extrabold text-slate-800">
              Không tìm thấy nhiệm vụ
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Hãy thử đổi bộ lọc hoặc nhập từ khóa khác.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}