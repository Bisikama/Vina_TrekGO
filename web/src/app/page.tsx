import { LoginForm } from "@/features/auth";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-xl text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-3 text-indigo-400">
          Feature-Based Architecture Base
        </h1>
        <p className="text-zinc-400 text-sm">
          Next.js App Router + TypeScript + Tailwind CSS + Zustand + Axios
        </p>
      </div>

      <div className="w-full max-w-md">
        <LoginForm />
        <Link href="/leader/public-trips" className="block mt-6 text-center text-indigo-300 underline">Quản lý Public Trip của Leader</Link>
      </div>
    </main>
  );
}
