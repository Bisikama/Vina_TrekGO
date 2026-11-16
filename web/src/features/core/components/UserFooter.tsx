import Image from "next/image";
import Link from "next/link";

const footerLinks = [
  { href: "/trips", label: "Chuyến đi" },
  { href: "/bookings", label: "Đặt chỗ & Vé" },
  { href: "/my-trips", label: "Chuyến đi của tôi" },
];

export const UserFooter = () => {
  return (
    <footer className="border-t border-[#E5E7EB] bg-[#F7F7F4]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/dashboard"
            aria-label="VinaTrekGO · Trang chủ"
            className="inline-flex min-h-11 items-center gap-2.5 rounded-lg font-bold text-[#125238] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#125238]"
          >
            <Image
              src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
              alt=""
              width={36}
              height={36}
              className="rounded-lg border border-[#E5E7EB] bg-white object-cover"
            />
            VinaTrekGO
          </Link>
          <small className="text-xs text-slate-600">© {new Date().getFullYear()} VinaTrekGO</small>
        </div>

        <nav aria-label="Điều hướng chân trang">
          <ul className="flex flex-wrap items-center gap-x-5 text-sm font-semibold text-slate-700">
            {footerLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:text-[#125238] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#125238]"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
};
