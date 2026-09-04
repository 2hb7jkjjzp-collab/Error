import { getPool } from "../pool.js";

export async function startAgentRun(agent: string, trigger: string): Promise<string> {
  const { rows } = await getPool().query<{ run_id: string }>(
    "INSERT INTO agent_runs (agent, trigger, status) VALUES ($1,$2,'RUNNING') RETURNING run_id",
    [agent, trigger]
  );
  return rows[0].run_id;
}

export async function finishAgentRun(
  runId: string,
  status: "SUCCEEDED" | "FAILED",
  stats: Record<string, unknown> = {}
): Promise<void> {
  await getPool().query(
    "UPDATE agent_runs SET status = $2, stats = $3, finished_at = now() WHERE run_id = $1",
    [runId, status, JSON.stringify(stats)]
  );
}

export async function listRecentRuns(limit = 50) {
  const { rows } = await getPool().query(
    "SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT $1",
    [limit]
  );
  return rows;
}

export async function currentAgentActivity() {
  const { rows } = await getPool().query(
    `SELECT DISTINCT ON (agent) agent, run_id, status, started_at, stats
     FROM agent_runs ORDER BY agent, started_at DESC`
  );
  return rows;
}
