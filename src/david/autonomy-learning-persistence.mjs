import { buildLearningCycle } from "./learning-loop.mjs";

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function assembleAutonomyLearningInput(run, steps = [], observations = []) {
  const plan = asObject(run.plan);
  const outcome = asObject(run.outcome);
  const orderedSteps = [...asArray(steps)].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  const actions = orderedSteps.map((step) => ({
    sequence: Number(step.sequence || 0),
    kind: step.step_kind || "act",
    tool: step.tool_name || null,
    reason: step.reason || null,
    expected: step.expected || null,
    status: step.status || "unknown",
    input: asObject(step.input),
    output: asObject(step.output),
  }));

  const evidence = asArray(observations)
    .filter((item) => item && (item.summary || item.sha256 || item.data))
    .map((item) => ({
      kind: item.kind || "observation",
      summary: item.summary || null,
      sha256: item.sha256 || null,
      data: asObject(item.data),
    }));

  const goal = String(
    run.goal ||
    plan.goal ||
    plan.summary ||
    outcome.goal ||
    `Autonomy task ${run.task_id || run.id || "unknown"}`
  ).trim();

  const started = run.started_at ? new Date(run.started_at).getTime() : NaN;
  const ended = run.completed_at ? new Date(run.completed_at).getTime() : NaN;
  const durationMs = Number.isFinite(started) && Number.isFinite(ended) && ended >= started ? ended - started : null;

  return {
    id: run.id || null,
    taskId: run.task_id || null,
    ownerId: run.owner_id || null,
    workerId: run.worker_id || null,
    status: run.status || "unknown",
    goal,
    plan: asArray(plan.steps),
    actions,
    observations: evidence,
    evidence,
    error: run.error || null,
    durationMs,
  };
}

export function buildAutonomyLessonRecord(run, steps = [], observations = [], prior = {}) {
  const learningInput = assembleAutonomyLearningInput(run, steps, observations);
  const cycle = buildLearningCycle(learningInput, prior);

  return {
    sourceRunId: learningInput.id,
    sourceTaskId: learningInput.taskId,
    ownerId: learningInput.ownerId,
    workerId: learningInput.workerId,
    lesson: cycle.lesson,
    promoteSkill: cycle.promoteSkill,
    generatedAt: cycle.generatedAt,
  };
}

export function buildSkillCandidate(record, name) {
  if (!record?.promoteSkill) return null;
  if (!record.ownerId) throw new Error("owner_id_required");
  const skillName = String(name || record.lesson?.summary || "learned-skill").trim().slice(0, 160);
  return {
    owner_id: record.ownerId,
    name: skillName,
    version: 1,
    description: record.lesson.summary,
    definition: {
      kind: record.lesson.kind,
      recipe: record.lesson.recipe,
      evidence: record.lesson.evidence,
      metrics: record.lesson.metrics,
      source_run_id: record.sourceRunId,
      source_task_id: record.sourceTaskId,
      worker_id: record.workerId,
    },
    source: "autonomy_learning",
    confidence: record.lesson.confidence,
    risk_level: "low",
    requires_confirmation: true,
    enabled: true,
  };
}

export async function loadAutonomyRunLearningBundle(db, runId) {
  if (!db || typeof db.from !== "function") throw new Error("db_client_required");
  if (!runId) throw new Error("run_id_required");

  const runResult = await db.from("david_autonomy_runs").select("*").eq("id", runId).single();
  if (runResult.error) throw runResult.error;

  const [stepsResult, observationsResult] = await Promise.all([
    db.from("david_autonomy_steps").select("*").eq("run_id", runId).order("sequence", { ascending: true }),
    db.from("david_autonomy_observations").select("*").eq("run_id", runId).order("created_at", { ascending: true }),
  ]);
  if (stepsResult.error) throw stepsResult.error;
  if (observationsResult.error) throw observationsResult.error;

  return {
    run: runResult.data,
    steps: stepsResult.data || [],
    observations: observationsResult.data || [],
  };
}

export async function learnFromAutonomyRun(db, runId, prior = {}, options = {}) {
  const bundle = await loadAutonomyRunLearningBundle(db, runId);
  const record = buildAutonomyLessonRecord(bundle.run, bundle.steps, bundle.observations, prior);
  const skill = buildSkillCandidate(record, options.skillName);

  if (!options.persistSkill || !skill) {
    return { record, skill, persisted: false };
  }

  const insertResult = await db.from("david_skills").insert(skill).select("*").single();
  if (insertResult.error) throw insertResult.error;
  return { record, skill: insertResult.data, persisted: true };
}
