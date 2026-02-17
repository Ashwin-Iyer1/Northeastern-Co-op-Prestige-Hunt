"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Company {
  company_name: string;
  elo: number;
}

const PAGE_SIZE = 20;

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const fetchCompanies = useCallback(
    async (start: number, end: number, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const res = await fetch(
          `/api/companies?start=${start}&end=${end}`
        );
        if (!res.ok) throw new Error("Failed to fetch companies");
        const { data, count } = await res.json();

        setCompanies((prev) => {
          if (!append) return data;
          const existing = new Set(prev.map((c: Company) => c.company_name));
          const unique = data.filter((c: Company) => !existing.has(c.company_name));
          return [...prev, ...unique];
        });
        if (count !== null) setTotalCount(count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchCompanies(0, PAGE_SIZE - 1);
  }, [fetchCompanies]);

  const handleMore = () => {
    const nextStart = companies.length;
    const nextEnd = nextStart + PAGE_SIZE - 1;
    fetchCompanies(nextStart, nextEnd, true);
  };

  const hasMore =
    totalCount !== null && companies.length < totalCount;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-2xl px-6 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-[var(--font-pixel)]">
            Top Companies by Prestige
          </h1>
          <Link
            href="/battle"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Battle
          </Link>
        </div>

        {loading && (
          <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
        )}

        {error && (
          <p className="text-red-500">Error: {error}</p>
        )}

        {!loading && !error && (
          <>
            <ol className="space-y-2">
              {companies.map((company, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
                      {index + 1}
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {company.company_name}
                    </span>
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Score: {company.elo}
                  </span>
                </li>
              ))}
            </ol>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-zinc-300 bg-white px-6 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  {loadingMore ? "Loading…" : "More"}
                </button>
              </div>
            )}

            {totalCount !== null && (
              <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                Showing {companies.length} of {totalCount}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
