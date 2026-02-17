import { supabase } from "@/app/lib/supabase";
import { battleTokens } from "@/app/lib/battle-tokens";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const MAX_ELO_DIFF = 200;
const MAX_RANK_DIFF = 10;

export async function GET() {
  // Fetch all companies ordered by ELO descending (index = rank)
  const { data: allCompanies, error: fetchError } = await supabase
    .from("companies")
    .select("id, company_name, elo")
    .order("elo", { ascending: false });

  if (fetchError || !allCompanies || allCompanies.length < 2) {
    return NextResponse.json(
      { error: "Could not fetch companies" },
      { status: 500 }
    );
  }

  // Pick a random company
  const idx1 = Math.floor(Math.random() * allCompanies.length);
  const company1 = allCompanies[idx1];

  // Find eligible opponents: within 200 ELO or 10 ranks
  const eligible = allCompanies.filter((c, idx) => {
    if (c.id === company1.id) return false;
    const eloDiff = Math.abs(c.elo - company1.elo);
    const rankDiff = Math.abs(idx - idx1);
    return eloDiff <= MAX_ELO_DIFF || rankDiff <= MAX_RANK_DIFF;
  });

  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "No eligible opponents found" },
      { status: 500 }
    );
  }

  const company2 = eligible[Math.floor(Math.random() * eligible.length)];

  // Create a single-use token tied to this matchup
  const token = randomUUID();
  battleTokens.set(token, {
    company_1: company1.id,
    company_2: company2.id,
    created_at: Date.now(),
  });

  return NextResponse.json({
    data: [company1, company2],
    token,
  });
}
