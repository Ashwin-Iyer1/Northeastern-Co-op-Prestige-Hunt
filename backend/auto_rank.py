import os
import random
import time
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI
from supabase import create_client, Client

load_dotenv()

# ── Config ──────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_ENDPOINT"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
OPENAI_API_KEY = os.environ["openai_api_key"]

TOTAL_BATTLES = 10_000
K = 20  # ELO K-factor (matches the frontend)
ELO_PROXIMITY_WINDOW = 100  # max ELO difference for "similar" matchups
BATCH_PRINT_EVERY = 50  # progress log frequency
MAX_CONCURRENT = 50  # max parallel OpenAI requests (stay under rate limits)

# ── Clients ─────────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)


# ── Helpers ─────────────────────────────────────────────────────────────
def fetch_all_companies() -> list[dict]:
    """Fetch every company from the database."""
    all_companies = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            supabase.table("companies")
            .select("id, company_name, elo")
            .order("elo", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not resp.data:
            break
        all_companies.extend(resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size
    return all_companies


def pick_similar_matchup(companies: list[dict]) -> tuple[dict, dict]:
    """Pick two companies with similar ELO ratings."""
    # Sort by elo so neighbours are close
    sorted_companies = sorted(companies, key=lambda c: c["elo"])
    n = len(sorted_companies)

    # Build a list of candidate pairs (adjacent or near-adjacent)
    # Pick a random anchor, then pick a neighbour within the window
    anchor_idx = random.randint(0, n - 1)
    anchor = sorted_companies[anchor_idx]

    # Collect candidates within the ELO window
    candidates = []
    for i in range(max(0, anchor_idx - 20), min(n, anchor_idx + 21)):
        if i == anchor_idx:
            continue
        if abs(sorted_companies[i]["elo"] - anchor["elo"]) <= ELO_PROXIMITY_WINDOW:
            candidates.append(sorted_companies[i])

    # If no close candidates (edge case), just pick a random different company
    if not candidates:
        opponent = anchor
        while opponent["id"] == anchor["id"]:
            opponent = random.choice(sorted_companies)
        return anchor, opponent

    opponent = random.choice(candidates)
    return anchor, opponent


def ask_gpt_winner(company_a: str, company_b: str) -> str:
    """Ask GPT which company is more prestigious. Returns the name."""
    prompt = (
        "You are an expert on company prestige and reputation, especially among "
        "college students and new graduates seeking co-ops and internships at Northeastern University. "
        "Between the following two companies, which one is generally considered MORE prestigious "
        "to work at? Consider factors like brand recognition, selectivity, compensation, "
        "career growth, and cultural cachet.\n\n"
        f"Company A: {company_a}\n"
        f"Company B: {company_b}\n\n"
        "Reply with ONLY the full company name of the winner. Nothing else."
    )
    return prompt


async def call_gpt(prompt: str, semaphore: asyncio.Semaphore) -> str:
    """Call OpenAI with concurrency limiting."""
    async with semaphore:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=100,
        )
        return response.choices[0].message.content.strip()


UPSET_BONUS_SCALE = 0.5  # extra K per 100 ELO gap when underdog wins (tune as needed)

def compute_new_elos(
    winner_elo: float, loser_elo: float
) -> tuple[float, float]:
    """ELO update with upset bonus: low-ELO winners earn extra points."""
    expected_win = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    expected_lose = 1 - expected_win

    # Upset bonus: if the winner had a lower ELO, scale up their K-factor
    elo_gap = loser_elo - winner_elo  # positive when underdog wins
    if elo_gap > 0:
        upset_multiplier = 1 + UPSET_BONUS_SCALE * (elo_gap / 100)
    else:
        upset_multiplier = 1.0

    new_winner = winner_elo + K * upset_multiplier * (1 - expected_win)
    new_loser = loser_elo + K * (0 - expected_lose)
    return new_winner, new_loser


def update_elo_in_db(company_id: int, new_elo: float) -> None:
    supabase.table("companies").update({"elo": round(new_elo)}).eq("id", company_id).execute()


# ── Main loop ───────────────────────────────────────────────────────────
async def main():
    print("Fetching all companies from Supabase…")
    companies = fetch_all_companies()
    print(f"Loaded {len(companies)} companies.\n")

    if len(companies) < 2:
        print("Need at least 2 companies to battle. Exiting.")
        return

    # Build dicts for fast lookup / in-memory ELO tracking
    elo_map: dict[int, float] = {c["id"]: c["elo"] for c in companies}
    name_map: dict[int, str] = {c["id"]: c["company_name"] for c in companies}

    wins = 0
    errors = 0
    start = time.time()
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    # Process in batches of MAX_CONCURRENT
    battle_num = 0
    while battle_num < TOTAL_BATTLES:
        batch_size = min(MAX_CONCURRENT, TOTAL_BATTLES - battle_num)

        # Refresh local companies list with current in-memory ELOs
        for c in companies:
            c["elo"] = elo_map[c["id"]]

        # Generate matchups for the batch
        matchups = []
        for _ in range(batch_size):
            a, b = pick_similar_matchup(companies)
            matchups.append((a, b))

        # Build prompts and fire all GPT calls in parallel
        prompts = [
            ask_gpt_winner(name_map[a["id"]], name_map[b["id"]])
            for a, b in matchups
        ]
        tasks = [call_gpt(p, semaphore) for p in prompts]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results sequentially (ELO updates must be serial for consistency)
        for i, (result, (company_a, company_b)) in enumerate(zip(results, matchups)):
            battle_num += 1

            if isinstance(result, Exception):
                errors += 1
                print(f"  [!] Battle {battle_num}: OpenAI error – {result}")
                continue

            winner_name = result
            a_name = name_map[company_a["id"]]
            b_name = name_map[company_b["id"]]

            # Determine winner / loser via fuzzy match
            if winner_name.lower().strip() == a_name.lower().strip():
                winner, loser = company_a, company_b
            elif winner_name.lower().strip() == b_name.lower().strip():
                winner, loser = company_b, company_a
            elif a_name.lower() in winner_name.lower():
                winner, loser = company_a, company_b
            elif b_name.lower() in winner_name.lower():
                winner, loser = company_b, company_a
            else:
                errors += 1
                print(
                    f"  [?] Battle {battle_num}: unclear answer '{winner_name}' "
                    f"for {a_name} vs {b_name} – skipping"
                )
                continue

            # Compute new ELOs
            new_winner_elo, new_loser_elo = compute_new_elos(
                elo_map[winner["id"]], elo_map[loser["id"]]
            )

            # Update in-memory
            elo_map[winner["id"]] = new_winner_elo
            elo_map[loser["id"]] = new_loser_elo

            # Update database
            try:
                update_elo_in_db(winner["id"], new_winner_elo)
                update_elo_in_db(loser["id"], new_loser_elo)
                print(f"  [+] Battle {battle_num}: {name_map[winner['id']]} beat {name_map[loser['id']]}")
                wins += 1
            except Exception as e:
                errors += 1
                print(f"  [!] Battle {battle_num}: DB error – {e}")
                continue

            if battle_num % BATCH_PRINT_EVERY == 0:
                elapsed = time.time() - start
                rate = battle_num / elapsed if elapsed > 0 else 0
                print(
                    f"  Battle {battle_num:>6}/{TOTAL_BATTLES} | "
                    f"{name_map[winner['id']]:>30} beat {name_map[loser['id']]:<30} | "
                    f"OK={wins} ERR={errors} | {rate:.1f} battles/s"
                )

    elapsed = time.time() - start
    print(f"\nDone! {wins} successful battles, {errors} errors in {elapsed:.1f}s")


if __name__ == "__main__":
    asyncio.run(main()) 