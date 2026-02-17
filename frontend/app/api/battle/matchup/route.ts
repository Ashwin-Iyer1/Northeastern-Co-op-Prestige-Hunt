import { supabase } from "@/app/lib/supabase";
import { battleTokens } from "@/app/lib/battle-tokens";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET() {
  // Get total company count
  const { count, error: countError } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true });

  if (countError || count === null || count < 2) {
    return NextResponse.json(
      { error: "Could not fetch companies" },
      { status: 500 }
    );
  }

  // Pick 2 different random indices
  const idx1 = Math.floor(Math.random() * count);
  let idx2 = Math.floor(Math.random() * (count - 1));
  if (idx2 >= idx1) idx2++;

  // Fetch both companies in parallel
  const [res1, res2] = await Promise.all([
    supabase
      .from("companies")
      .select("id, company_name, elo")
      .order("id", { ascending: true })
      .range(idx1, idx1)
      .single(),
    supabase
      .from("companies")
      .select("id, company_name, elo")
      .order("id", { ascending: true })
      .range(idx2, idx2)
      .single(),
  ]);

  if (res1.error || res2.error || !res1.data || !res2.data) {
    return NextResponse.json(
      { error: "Could not fetch matchup" },
      { status: 500 }
    );
  }

  // Create a single-use token tied to this matchup
  const token = randomUUID();
  battleTokens.set(token, {
    company_1: res1.data.id,
    company_2: res2.data.id,
    created_at: Date.now(),
  });

  return NextResponse.json({
    data: [res1.data, res2.data],
    token,
  });
}
