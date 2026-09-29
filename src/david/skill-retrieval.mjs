const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","in","is","it","of","on","or","that","the","this","to","with",
]);

const tokenize = (text) => String(text || "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^\p{L}\p{N}_-]+/gu, " ")
  .split(/\s+/)
  .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));

export function skillEligibility(skill, options = {}) {
  const minConfidence = Number.isFinite(Number(options.minConfidence)) ? Number(options.minConfidence) : 0.55;
  const allowedRisk = new Set(options.allowedRisk || ["low", "medium"]);

  if (!skill || skill.enabled === false) return { eligible: false, reason: "disabled" };
  if (!allowedRisk.has(skill.risk_level || "low")) return { eligible: false, reason: "risk" };
  if (Number(skill.confidence || 0) < minConfidence) return { eligible: false, reason: "confidence" };
  if (options.requireConfirmed && skill.requires_confirmation) return { eligible: false, reason: "confirmation" };
  return { eligible: true, reason: "ok" };
}

export function scoreSkillForGoal(goal, skill) {
  const goalTokens = new Set(tokenize(goal));
  const definition = skill?.definition && typeof skill.definition === "object" ? skill.definition : {};
  const recipeText = Array.isArray(definition.recipe)
    ? definition.recipe.map((step) => JSON.stringify(step)).join(" ")
    : "";
  const skillText = [
    skill?.name,
    skill?.description,
    definition.kind,
    recipeText,
  ].filter(Boolean).join(" ");
  const skillTokens = new Set(tokenize(skillText));

  if (goalTokens.size === 0 || skillTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of goalTokens) if (skillTokens.has(token)) overlap += 1;

  const lexical = overlap / Math.max(1, goalTokens.size);
  const confidence = clamp(Number(skill?.confidence || 0));
  const totalOutcomes = Math.max(0, Number(skill?.success_count || 0)) + Math.max(0, Number(skill?.failure_count || 0));
  const reliability = totalOutcomes === 0
    ? 0.5
    : Number(skill?.success_count || 0) / totalOutcomes;

  return Number(clamp(lexical * 0.6 + confidence * 0.25 + reliability * 0.15).toFixed(4));
}

export function rankSkillsForGoal(goal, skills = [], options = {}) {
  const ranked = [];
  for (const skill of Array.isArray(skills) ? skills : []) {
    const eligibility = skillEligibility(skill, options);
    if (!eligibility.eligible) continue;
    const score = scoreSkillForGoal(goal, skill);
    if (score < (options.minScore ?? 0.2)) continue;
    ranked.push({ skill, score });
  }
  return ranked.sort((a, b) =>
    b.score - a.score ||
    Number(b.skill?.confidence || 0) - Number(a.skill?.confidence || 0) ||
    Number(b.skill?.success_count || 0) - Number(a.skill?.success_count || 0)
  );
}

export function selectStrategyForGoal(goal, skills = [], options = {}) {
  const ranked = rankSkillsForGoal(goal, skills, options);
  if (ranked.length === 0) {
    return {
      strategy: "plan_fresh",
      selectedSkill: null,
      score: 0,
      candidates: [],
    };
  }

  const best = ranked[0];
  const minReuseScore = Number.isFinite(Number(options.minReuseScore)) ? Number(options.minReuseScore) : 0.45;

  return {
    strategy: best.score >= minReuseScore ? "reuse_skill" : "plan_fresh",
    selectedSkill: best.score >= minReuseScore ? best.skill : null,
    score: best.score,
    candidates: ranked.slice(0, options.maxCandidates || 5),
  };
}

export async function loadOwnerSkills(db, ownerId, options = {}) {
  if (!db || typeof db.from !== "function") throw new Error("db_client_required");
  if (!ownerId) throw new Error("owner_id_required");

  let query = db
    .from("david_skills")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("enabled", true)
    .order("confidence", { ascending: false })
    .order("success_count", { ascending: false });

  if (Number.isFinite(Number(options.limit))) query = query.limit(Number(options.limit));

  const result = await query;
  if (result.error) throw result.error;
  return result.data || [];
}

export async function chooseLearnedStrategy(db, ownerId, goal, options = {}) {
  const skills = await loadOwnerSkills(db, ownerId, { limit: options.limit || 100 });
  return selectStrategyForGoal(goal, skills, options);
}
