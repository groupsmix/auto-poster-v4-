// ============================================================
// Job Queue Service — D1 State Machine
// Replaces: CF Workflows with D1-based job queue
// ============================================================

export interface Job {
  id: string;
  niche_id: string;
  job_type: string;
  entity_type: string;
  entity_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  current_step?: string;
  total_steps: number;
  completed_steps: number;
  steps_json: string;
  input_json: string;
  output_json: string;
  error?: string;
  retry_count: number;
  max_retries: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  worker_id?: string;
  locked_at?: string;
  lock_expires_at?: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CreateJobInput {
  niche_id: string;
  job_type: string;
  entity_type: string;
  entity_id: string;
  input_json?: Record<string, unknown>;
  priority?: number;
  scheduled_at?: string;
  steps?: Array<{ name: string; status?: string }>;
}

export class JobQueueService {
  constructor(private db: D1Database) {}

  // Create a new job
  async createJob(input: CreateJobInput): Promise<Job> {
    const id = crypto.randomUUID();
    const steps = input.steps?.map(s => ({ ...s, status: 'pending' })) || [];
    
    const job: Job = {
      id,
      niche_id: input.niche_id,
      job_type: input.job_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      status: input.scheduled_at ? 'pending' : 'pending',
      total_steps: steps.length,
      completed_steps: 0,
      steps_json: JSON.stringify(steps),
      input_json: JSON.stringify(input.input_json || {}),
      output_json: '{}',
      retry_count: 0,
      max_retries: 3,
      scheduled_at: input.scheduled_at,
      priority: input.priority ?? 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.db.prepare(`
      INSERT INTO job_queue (
        id, niche_id, job_type, entity_type, entity_id, status,
        total_steps, completed_steps, steps_json, input_json, output_json,
        retry_count, max_retries, scheduled_at, priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      job.id, job.niche_id, job.job_type, job.entity_type, job.entity_id, job.status,
      job.total_steps, job.completed_steps, job.steps_json, job.input_json, job.output_json,
      job.retry_count, job.max_retries, job.scheduled_at, job.priority, job.created_at, job.updated_at
    ).run();

    return job;
  }

  // Claim jobs for processing (atomic operation)
  async claimJobs(workerId: string, limit: number = 5, lockTimeoutSeconds: number = 300): Promise<Job[]> {
    const now = new Date().toISOString();
    const lockExpiresAt = new Date(Date.now() + lockTimeoutSeconds * 1000).toISOString();

    // First, find available jobs
    const { results } = await this.db.prepare(`
      SELECT * FROM job_queue 
      WHERE status = 'pending' 
        AND (scheduled_at IS NULL OR scheduled_at <= ?)
        AND (lock_expires_at IS NULL OR lock_expires_at < ?)
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `).bind(now, now, limit).all<Job>();

    if (!results || results.length === 0) return [];

    // Try to claim each job atomically
    const claimed: Job[] = [];
    for (const job of results) {
      const result = await this.db.prepare(`
        UPDATE job_queue 
        SET worker_id = ?, locked_at = ?, lock_expires_at = ?, status = 'running', started_at = ?
        WHERE id = ? AND (worker_id IS NULL OR lock_expires_at < ?)
      `).bind(workerId, now, lockExpiresAt, now, job.id, now).run();

      if (result.meta?.changes && result.meta.changes > 0) {
        claimed.push({ ...job, worker_id: workerId, locked_at: now, lock_expires_at: lockExpiresAt, status: 'running' });
      }
    }

    return claimed;
  }

  // Update job status
  async updateJobStatus(jobId: string, status: Job['status'], updates: Partial<Job> = {}): Promise<void> {
    const setClauses: string[] = ['status = ?'];
    const values: (string | number | null)[] = [status];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    values.push(jobId);

    await this.db.prepare(`
      UPDATE job_queue SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...values).run();
  }

  // Update step progress
  async updateStepProgress(jobId: string, stepName: string, stepStatus: string, output?: Record<string, unknown>): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const steps = JSON.parse(job.steps_json);
    const stepIndex = steps.findIndex((s: any) => s.name === stepName);
    
    if (stepIndex >= 0) {
      steps[stepIndex].status = stepStatus;
      steps[stepIndex].completed_at = new Date().toISOString();
      if (output) steps[stepIndex].output = output;
    }

    const completedSteps = steps.filter((s: any) => s.status === 'completed').length;
    
    await this.db.prepare(`
      UPDATE job_queue 
      SET steps_json = ?, completed_steps = ?, current_step = ?, output_json = ?
      WHERE id = ?
    `).bind(
      JSON.stringify(steps),
      completedSteps,
      stepName,
      output ? JSON.stringify(output) : job.output_json,
      jobId
    ).run();
  }

  // Get job by ID
  async getJob(jobId: string): Promise<Job | null> {
    const result = await this.db.prepare('SELECT * FROM job_queue WHERE id = ?').bind(jobId).first<Job>();
    return result || null;
  }

  // List jobs with filtering
  async listJobs(filters: {
    niche_id?: string;
    status?: string;
    job_type?: string;
    entity_id?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ jobs: Job[]; total: number }> {
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (filters.niche_id) {
      conditions.push('niche_id = ?');
      values.push(filters.niche_id);
    }
    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }
    if (filters.job_type) {
      conditions.push('job_type = ?');
      values.push(filters.job_type);
    }
    if (filters.entity_id) {
      conditions.push('entity_id = ?');
      values.push(filters.entity_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { results } = await this.db.prepare(`
      SELECT * FROM job_queue ${whereClause}
      ORDER BY priority ASC, created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...values, filters.limit ?? 50, filters.offset ?? 0).all<Job>();

    const countResult = await this.db.prepare(`
      SELECT COUNT(*) as total FROM job_queue ${whereClause}
    `).bind(...values).first<{ total: number }>();

    return { jobs: results || [], total: countResult?.total ?? 0 };
  }

  // Schedule a retry
  async scheduleRetry(jobId: string, delayMs: number): Promise<void> {
    const scheduledAt = new Date(Date.now() + delayMs).toISOString();
    await this.db.prepare(`
      UPDATE job_queue 
      SET status = 'pending', scheduled_at = ?, worker_id = NULL, locked_at = NULL, lock_expires_at = NULL
      WHERE id = ?
    `).bind(scheduledAt, jobId).run();
  }

  // Cancel a job
  async cancelJob(jobId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE job_queue 
      SET status = 'cancelled', completed_at = ?
      WHERE id = ? AND status IN ('pending', 'running', 'paused')
    `).bind(new Date().toISOString(), jobId).run();
  }

  // Pause a job
  async pauseJob(jobId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE job_queue 
      SET status = 'paused', worker_id = NULL, locked_at = NULL, lock_expires_at = NULL
      WHERE id = ? AND status = 'running'
    `).bind(jobId).run();
  }

  // Resume a paused job
  async resumeJob(jobId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE job_queue 
      SET status = 'pending', scheduled_at = NULL
      WHERE id = ? AND status = 'paused'
    `).bind(jobId).run();
  }

  // Release stale locks (called by cron)
  async releaseStaleLocks(maxAgeSeconds: number = 300): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeSeconds * 1000).toISOString();
    
    const result = await this.db.prepare(`
      UPDATE job_queue 
      SET status = 'pending', worker_id = NULL, locked_at = NULL, lock_expires_at = NULL
      WHERE status = 'running' AND lock_expires_at < ?
    `).bind(cutoff).run();

    return result.meta?.changes ?? 0;
  }

  // Get queue statistics
  async getStats(nicheId?: string): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    paused: number;
  }> {
    const conditions = nicheId ? 'WHERE niche_id = ?' : '';
    const values = nicheId ? [nicheId] : [];

    const { results } = await this.db.prepare(`
      SELECT status, COUNT(*) as count FROM job_queue ${conditions} GROUP BY status
    `).bind(...values).all<{ status: string; count: number }>();

    const stats = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 };
    for (const row of results || []) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }
    return stats;
  }

  // Pause all jobs in a niche (for kill switch)
  async pauseAllJobsInNiche(nicheId: string): Promise<number> {
    const result = await this.db.prepare(`
      UPDATE job_queue 
      SET status = 'paused', worker_id = NULL, locked_at = NULL, lock_expires_at = NULL
      WHERE niche_id = ? AND status IN ('pending', 'running')
    `).bind(nicheId).run();

    return result.meta?.changes ?? 0;
  }

  // Get jobs by entity (useful for tracking product workflows)
  async getJobsByEntity(entityType: string, entityId: string): Promise<Job[]> {
    const { results } = await this.db.prepare(`
      SELECT * FROM job_queue 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `).bind(entityType, entityId).all<Job>();

    return results || [];
  }
}
