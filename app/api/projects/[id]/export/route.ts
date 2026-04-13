import { NextResponse } from "next/server";
import { buildProjectZip } from "@/lib/exporter";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const zip = await buildProjectZip(id);

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${id}.zip"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
