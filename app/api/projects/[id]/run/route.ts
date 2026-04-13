import { NextResponse } from "next/server";
import { runProjectWorkflow } from "@/lib/workflow-engine";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await runProjectWorkflow(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
