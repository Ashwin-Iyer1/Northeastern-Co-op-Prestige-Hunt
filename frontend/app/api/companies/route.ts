import { supabase } from "@/app/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = parseInt(searchParams.get("start") ?? "0", 10);
  const end = parseInt(searchParams.get("end") ?? "19", 10);

  const { data, error, count } = await supabase
    .from("companies")
    .select("company_name, elo", { count: "exact" })
    .order("elo", { ascending: false })
    .range(start, end);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}
