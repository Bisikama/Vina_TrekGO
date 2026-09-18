"use client";

import React from "react";
import { useLogin } from "../hooks/useLogin";
import { useAuthStore } from "../store/authStore";

export const LoginForm = () => {
  const { formData, isLoading, error, handleChange, handleSubmit } = useLogin();
  const { user, isAuthenticated, logout } = useAuthStore();

  if (isAuthenticated && user) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          Welcome, {user.name}!
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Logged in as <span className="font-semibold text-indigo-500">{user.email}</span>
        </p>
        <button
          onClick={logout}
          className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow transition text-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6 text-center">
        Sign In to Your Account
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="email" 
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-zinc-900 dark:text-white placeholder-zinc-400 text-sm transition"
          />
        </div>

        <div>
          <label 
            htmlFor="password" 
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Password <span className="text-xs text-zinc-400 font-normal">(demo: password123)</span>
          </label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="••••••••"
            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-zinc-900 dark:text-white placeholder-zinc-400 text-sm transition"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg shadow transition flex items-center justify-center text-sm"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </div>
  );
};
