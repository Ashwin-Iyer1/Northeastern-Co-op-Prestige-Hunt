"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Company {
  id: number;
  company_name: string;
  elo: number;
}

interface Matchup {
  data: Company[];
  token: string;
}

export default function BattlePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatchup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/battle/matchup");
      if (!res.ok) throw new Error("Failed to fetch matchup");
      const matchup: Matchup = await res.json();
      setCompanies(matchup.data);
      setToken(matchup.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatchup();
  }, [fetchMatchup]);

  const handleVote = async (winnerId: number, loserId: number) => {
    // Fire-and-forget the vote, immediately load next matchup
    fetch("/api/battle/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        winner_id: winnerId,
        loser_id: loserId,
        token,
      }),
    });
    fetchMatchup();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-2xl px-6 py-16">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            &larr; back to rankings
          </Link>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-pixel">
            Battle
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Choose which company you think is more prestigious.
          </p>
        </div>

        {error && (
          <p className="text-center text-red-500">Error: {error}</p>
        )}

        {loading && (
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            Loading…
          </p>
        )}

        {!loading && !error && companies.length === 2 && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => handleVote(companies[0].id, companies[1].id)}
              className="w-full max-w-md rounded-xl border border-zinc-200 bg-white px-6 py-5 text-center font-medium text-zinc-900 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {companies[0].company_name}
            </button>

            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-pixel">
              vs
            </span>

            <button
              onClick={() => handleVote(companies[1].id, companies[0].id)}
              className="w-full max-w-md rounded-xl border border-zinc-200 bg-white px-6 py-5 text-center font-medium text-zinc-900 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {companies[1].company_name}
            </button>

            <button
              onClick={fetchMatchup}
              className="mt-2 text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              skip
            </button>
          </div>
        )}

        {!loading && !error && companies.length !== 2 && (
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            Sorry, we couldn&apos;t find a matchup.
          </p>
        )}
      </main>
    </div>
  );
}
