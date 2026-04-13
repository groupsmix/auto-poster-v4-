import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/projects";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const project = await createProject(body);
    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create project";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
