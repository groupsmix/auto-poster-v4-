import { NextResponse } from "next/server";
import { getOpportunities } from "@/lib/opportunities";

export async function GET() {
  const opportunities = await getOpportunities();
  return NextResponse.json({ opportunities });
}
