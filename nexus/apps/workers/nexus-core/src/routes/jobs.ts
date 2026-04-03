// ============================================================
// Jobs API — D1 State Machine Job Queue
// ============================================================

import { Hono } from "hono";
import type { CoreEnv } from "../index";
import { JobQueueService } from "../services/job-queue";

const app = new Hono<{ Bindings: CoreEnv; Variables: { requestId: string; nicheId?: string } }>();

// GET /api/jobs — List jobs
app.get("/", async (c) => {
  const nicheId = c.get('nicheId')!;
  const query = c.req.query();
  
  const jobQueue = new JobQueueService(c.env.DB);
  const result = await jobQueue.listJobs({
    niche_id: nicheId,
    status: query.status,
    job_type: query.job_type,
    entity_id: query.entity_id,
    limit: query.limit ? parseInt(query.limit) : 50,
    offset: query.offset ? parseInt(query.offset) : 0,
  });
  
  return c.json({ success: true, data: result });
});

// GET /api/jobs/stats — Queue statistics
app.get("/stats", async (c) => {
  const nicheId = c.get('nicheId')!;
  const jobQueue = new JobQueueService(c.env.DB);
  const stats = await jobQueue.getStats(nicheId);
  
  return c.json({ success: true, data: stats });
});

// POST /api/jobs — Create a new job
app.post("/", async (c) => {
  const nicheId = c.get('nicheId')!;
  const body = await c.req.json<{
    job_type: string;
    entity_type: string;
    entity_id: string;
    input_json?: Record<string, unknown>;
    priority?: number;
    scheduled_at?: string;
    steps?: Array<{ name: string; status?: string }>;
  }>();
  
  const jobQueue = new JobQueueService(c.env.DB);
  const job = await jobQueue.createJob({
    niche_id: nicheId,
    job_type: body.job_type,
    entity_type: body.entity_type,
    entity_id: body.entity_id,
    input_json: body.input_json,
    priority: body.priority,
    scheduled_at: body.scheduled_at,
    steps: body.steps,
  });
  
  return c.json({ success: true, data: job }, 201);
});

// GET /api/jobs/:id — Get job details
app.get("/:id", async (c) => {
  const jobId = c.req.param('id');
  const nicheId = c.get('nicheId')!;
  
  const jobQueue = new JobQueueService(c.env.DB);
  const job = await jobQueue.getJob(jobId);
  
  if (!job) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }
  
  // Verify niche access
  if (job.niche_id !== nicheId) {
    return c.json({ success: false, error: 'Access denied' }, 403);
  }
  
  return c.json({ success: true, data: job });
});

// POST /api/jobs/:id/cancel — Cancel a job
app.post("/:id/cancel", async (c) => {
  const jobId = c.req.param('id');
  const nicheId = c.get('nicheId')!;
  
  const jobQueue = new JobQueueService(c.env.DB);
  const job = await jobQueue.getJob(jobId);
  
  if (!job) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }
  
  if (job.niche_id !== nicheId) {
    return c.json({ success: false, error: 'Access denied' }, 403);
  }
  
  await jobQueue.cancelJob(jobId);
  
  return c.json({ success: true, message: 'Job cancelled' });
});

// POST /api/jobs/:id/pause — Pause a job
app.post("/:id/pause", async (c) => {
  const jobId = c.req.param('id');
  const nicheId = c.get('nicheId')!;
  
  const jobQueue = new JobQueueService(c.env.DB);
  const job = await jobQueue.getJob(jobId);
  
  if (!job) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }
  
  if (job.niche_id !== nicheId) {
    return c.json({ success: false, error: 'Access denied' }, 403);
  }
  
  await jobQueue.pauseJob(jobId);
  
  return c.json({ success: true, message: 'Job paused' });
});

// POST /api/jobs/:id/resume — Resume a paused job
app.post("/:id/resume", async (c) => {
  const jobId = c.req.param('id');
  const nicheId = c.get('nicheId')!;
  
  const jobQueue = new JobQueueService(c.env.DB);
  const job = await jobQueue.getJob(jobId);
  
  if (!job) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }
  
  if (job.niche_id !== nicheId) {
    return c.json({ success: false, error: 'Access denied' }, 403);
  }
  
  await jobQueue.resumeJob(jobId);
  
  return c.json({ success: true, message: 'Job resumed' });
});

// GET /api/jobs/:id/progress — Get job progress
app.get("/:id/progress", async (c) => {
  const jobId = c.req.param('id');
  const nicheId = c.get('nicheId')!;
  
  const job = await c.env.DB.prepare(`
    SELECT id, status, current_step, total_steps, completed_steps, steps_json, error, created_at, updated_at
    FROM job_queue WHERE id = ? AND niche_id = ?
  `).bind(jobId, nicheId).first();
  
  if (!job) {
    return c.json({ success: false, error: 'Job not found' }, 404);
  }
  
  const steps = JSON.parse(job.steps_json as string);
  const progress = job.total_steps > 0 
    ? Math.round((job.completed_steps as number / job.total_steps as number) * 100)
    : 0;
  
  return c.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      current_step: job.current_step,
      progress_percent: progress,
      completed_steps: job.completed_steps,
      total_steps: job.total_steps,
      steps: steps,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
    }
  });
});

// POST /api/jobs/batch — Create multiple jobs at once
app.post("/batch", async (c) => {
  const nicheId = c.get('nicheId')!;
  const body = await c.req.json<{
    jobs: Array<{
      job_type: string;
      entity_type: string;
      entity_id: string;
      input_json?: Record<string, unknown>;
      priority?: number;
    }>;
  }>();
  
  const jobQueue = new JobQueueService(c.env.DB);
  const createdJobs = [];
  
  for (const jobInput of body.jobs) {
    const job = await jobQueue.createJob({
      niche_id: nicheId,
      ...jobInput,
    });
    createdJobs.push(job);
  }
  
  return c.json({ success: true, data: createdJobs }, 201);
});

export default app;
