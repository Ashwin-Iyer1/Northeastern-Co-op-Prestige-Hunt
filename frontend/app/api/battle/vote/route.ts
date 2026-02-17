import { supabase } from "@/app/lib/supabase";
import { battleTokens } from "@/app/lib/battle-tokens";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { winner_id, loser_id, token } = await request.json();

  if (!winner_id || !loser_id || !token) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // *** TOKEN VALIDATION ***
  const tokenData = battleTokens.get(token);
  if (!tokenData) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Delete token (single-use)
  battleTokens.delete(token);

  // Verify the companies match the token
  if (
    ![tokenData.company_1, tokenData.company_2].includes(winner_id) ||
    ![tokenData.company_1, tokenData.company_2].includes(loser_id) ||
    winner_id === loser_id
  ) {
    return NextResponse.json(
      { error: "Invalid winner or loser" },
      { status: 400 }
    );
  }
  // *** END TOKEN VALIDATION ***

  // Fetch current ELO for both companies
  const [winnerRes, loserRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, elo")
      .eq("id", winner_id)
      .single(),
    supabase
      .from("companies")
      .select("id, elo")
      .eq("id", loser_id)
      .single(),
  ]);

  if (winnerRes.error || loserRes.error || !winnerRes.data || !loserRes.data) {
    return NextResponse.json(
      { error: "Could not fetch company data" },
      { status: 500 }
    );
  }

  const winner = winnerRes.data;
  const loser = loserRes.data;

  // *** ELO CALCULATION ***
  // Standard ELO formula with K=20 (same effective average as prestigerank)
  const K = 20;
  const expectedWin = 1 / (1 + 10 ** ((loser.elo - winner.elo) / 400));
  const expectedLose = 1 - expectedWin;

  const newWinnerElo = winner.elo + K * (1 - expectedWin);
  const newLoserElo = loser.elo + K * (0 - expectedLose);
  // *** END ELO CALCULATION ***

  // Update both companies
  const [updateWinner, updateLoser] = await Promise.all([
    supabase
      .from("companies")
      .update({ elo: newWinnerElo })
      .eq("id", winner_id),
    supabase
      .from("companies")
      .update({ elo: newLoserElo })
      .eq("id", loser_id),
  ]);

  if (updateWinner.error || updateLoser.error) {
    return NextResponse.json(
      { error: "Could not update ELO scores" },
      { status: 500 }
    );
  }

  return NextResponse.json({ error: null });
}
