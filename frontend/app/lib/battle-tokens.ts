// In-memory battle token store.
// Each token maps to the two company IDs that were shown in the matchup.
// Tokens are single-use and expire after 5 minutes.

interface BattleToken {
  company_1: number;
  company_2: number;
  created_at: number;
}

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const battleTokens = new Map<string, BattleToken>();

// Periodically clean up expired tokens
function cleanup() {
  const now = Date.now();
  for (const [token, data] of battleTokens) {
    if (now - data.created_at > TOKEN_TTL_MS) {
      battleTokens.delete(token);
    }
  }
}

// Run cleanup every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(cleanup, 60_000);
}
