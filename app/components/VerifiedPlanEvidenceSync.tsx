"use client";

import { useEffect } from "react";

type Status = "green" | "yellow" | "red";
type Note = { evidence?: string; blocker?: string; updatedAt?: string };

const STATUS_KEY = "enchev-system-status-v5";
const NOTES_KEY = "enchev-system-notes-v5";
const CHANNEL_KEY = "enchev-system-realtime-v5";
// Governance verification marker only; runtime behavior is unchanged.

const VERIFIED_WAVE_0: Record<string, string> = {
  "00.01": "docs/00_01_SYSTEM_SCOPE_AND_BOUNDARIES.md · commit 1782e4deac453adb024c2322490ac94386656a07 · Vercel production READY",
  "00.02": "docs/00_02_ACTORS_AND_PERMISSION_MAP.md · commit 332e6ecc9cc1cda93768d5d01e5d02bae97dbc8f · Vercel production READY",
  "00.03": "docs/00_03_AUTHORITATIVE_COMPONENTS_DEFINED.md · implementation 2e5a17cb10fef4ca52a4fd52feba3b37449088e8 · GREEN evidence a3c9165c0aae6b0089feaa7ec783f5f79c521833 · Vercel production READY",
  "00.04": "docs/00_04_CRITICAL_SYSTEM_INVARIANTS.md · implementation e566fe6de2c9b668142cb671026e89282ece2e44 · GREEN evidence 7a8e2c2ed556a3c464d046802e2b59641e6d3e11 · Vercel dpl_4gawek1QQZDXmchB3fgsyC2R261d READY",
  "00.05": "docs/00_05_NON_FUNCTIONAL_REQUIREMENTS.md · implementation 520891b7e54b285551c11af38936b714a3665795 · GREEN evidence 01cdce178f8cf8f1876e6c1449822b2d942a39aa · Vercel dpl_EDhvaagA8dLXnqMD3a6rPPwn6mgy READY",
  "00.06": "docs/00_06_DEPENDENCY_INVENTORY.md · implementation 7bda0dbc9603ca068deac37591c9034f9c535c9c · GREEN evidence 151ea2a898f63a1d68f688e7de56f53634630583 · Vercel dpl_GEQf6ucwQZ8C4ctMEf7TPRhjGQCx READY",
  "00.07": "docs/00_07_DATA_CLASSIFICATION_MODEL.md · implementation 1561969541ca082008d26266464ca7c184ca1e3f · GREEN evidence 9227b045986a5f6b169ad58c5baedcbbd83fc890 · verified descendant e76a4e84bb43281a7891a89dc24eca49c6435a71 · Vercel dpl_8mVzSYNxUY6PicgULaEgvcYHhQ4t READY",
  "00.08": "docs/00_08_FAILURE_ASSUMPTIONS.md · implementation c727a95ac4924f18ce09c25aea720a6359ab4e1b · GREEN evidence 6970cf3fea2b8e4ec42c5326dba2511998f64ec9 · verified descendant 929b6f252231e34624253a13346e44e2f285aca1 · GitHub Actions run 35180993736 PASS · production HTTP/runtime healthy",
  "00.09": "docs/00_09_DEFINITION_OF_GREEN_ACCEPTANCE.md · implementation b0b6cc2585a610ad4fb443c729f7100bac727b77 · GREEN evidence 6100ef6b47dfa4efd74cfa8d255c0f6a70a0597c · verified descendant 22fd06835fb9f45e55600ab0e0fff976671efa2d · GitHub Actions run 35181246608 PASS · production HTTP 200/runtime healthy",
  "00.10": "docs/00_10_FINAL_PRODUCTION_ACCEPTANCE_CRITERIA.md · implementation d8fde92c648c666ace1a4d32b2dbef756d304f7c · GREEN evidence 3d09f1b0dfe35963fd5a1bcf10a3ccbeb1969910 · verified descendant aa9ce246bdb2ba0ea7c48f99e19d2127f613e373 · GitHub Actions run 35182138386 PASS · production HTTP 200/runtime healthy",
  "01.05": "docs/01_05_SUPABASE_PROJECT.md · binding config 37ca377d6c4a553313d7b2a11cf4e40d44506197 · verifier 8795af9214b6dcbc9e380b97950d18919cec01b2 · implementation 5d62ecef07a3717a773b603ff38483e6c7406259 · GitHub Actions run 35249157579 PASS · Supabase frhletkiuupgksmgxoxc ACTIVE_HEALTHY eu-west-1 · RLS/no public table grants · live Edge endpoint PASS · production HTTP 200/runtime clean",
  "01.08": "config/enchev-environment-variables.json · scripts/verify-environment-variables.mjs · CI integration 1b2f8876199c96f640ef48b9c70dd7fd38af885f · merged via PR #8 at 1ed96f6b5f9ac064a5c2a7f36c1d4dca2569e852 · GitHub Actions run 35395887965 PASS · environment invariant/self-tests/runtime probe PASS · TypeScript check PASS · production build PASS",
  "01.09": "scripts/lint-repository.mjs · scripts/run-ci-tests.mjs · scripts/verify-ci-quality-gates.mjs · workflow/package contract merged via PR #13 at eb0403f4cfb7e19b9568b3cbef8d386fe7b411a6 · GitHub Actions run 35396548974 PASS · repository lint PASS · CI aggregate tests PASS · TypeScript PASS · production build PASS",
  "01.10": "config/enchev-health-endpoints.json · app/api/health/{web,api,realtime,worker} · scripts/verify-health-endpoints.mjs · merged via PR #20 at f274ee52e2ca50924d4c11006a4383d8427a8a2e · GitHub Actions run 35397918516 PASS · health contract/self-tests PASS · CI aggregate PASS · TypeScript PASS · production build PASS · built next-start smoke test PASS (web/api 200 healthy; realtime/worker 503 expected unavailable state)",
  "02.01": "apps/web workspace · @enchev/web package · apps/web/boundary.json single-source root-app bridge · scripts/verify-apps-web.mjs · merged via PR #23 at 3ce5963c535e50b4fbf99640e32fc4fd83936b99 · GitHub Actions run 35398610778 PASS · apps/web boundary PASS · self-tests PASS · CI aggregate PASS · TypeScript PASS · production build PASS",
  "32.01": "docs/32_01_MASTER_TASK_IDS_IMMUTABLE.md · script 19298b8165922fae0e18f5d971104a474aa7877a · CI integration d05c2e6a0da4fab2e637eb0632a38fc845d45ea4 · GREEN evidence 1d9d92c9ae3c9d856eb6062e179ce55441047285 · GitHub Actions main run 35182701243 PASS · negative guard run 35182487279 FAIL-as-designed · production HTTP 200/runtime healthy",
  "32.02": "docs/32_02_NO_SILENT_DELETE_RENUMBER.md · guard a28c9b5a168d42d211850c16b18b7c391ad61a56 · CI integration 43e8cd3573f0acd39f6b38aef85c85ed20fea270 · GREEN evidence 1f5eb5f075fa1c492dccc8d0f43ac75311a6eebb · verified descendant b816f760fffb7b81b8f9f69e823e6892c244c010 · GitHub Actions run 35183021075 PASS · delete/renumber/reuse self-test PASS · production HTTP 200/runtime healthy",
  "32.03": "docs/32_03_GREEN_REQUIRES_EVIDENCE.md · guard 49f831a9c1fed32895b9a4e286e7f57d09aa0617 · CI integration f90b9a9da47ac579496c61acfdb1ba8d130052e4 · GREEN evidence 5f65fb63d4fc3b9f743145f161a9e1610d093cbe · GitHub Actions run 35183337380 PASS · GREEN evidence invariant/self-test PASS · production HTTP 200/runtime healthy",
  "32.04": "docs/32_04_GREEN_REQUIRES_PASSING_TEST.md · runtime guard fa52e2567bc45afabacf4472f00d4e4747e2fd42 · CI run 35183833517 PASS · final integration run 35183951638 PASS · production descendant 149b4d57d6f3c66a07eb9c6275339acc7b8ff65b · Vercel dpl_BGHLv7uyatsCXSiUcC1kV9g2ujaL READY · 236 test tasks governed · production HTTP 200/runtime clean",
  "32.05": "docs/32_05_YELLOW_PARTIAL_ERROR_PENDING.md · verifier aa6d64dc54b0b5b1fbd6278a673433e86121197e · CI integration 7363c289db2939c80340964f3b1c1f3d89f0b806 · GREEN evidence d124a9a6136a428865d094f57c7bbff2ecc346fd · verified descendant ddb63f31c98869890bc70749c93e489575da39b3 · GitHub Actions run 35212105730 PASS · YELLOW invariant/self-tests PASS · production HTTP 200/runtime healthy",
  "32.06": "docs/32_06_RED_NOT_IMPLEMENTED.md · verifier 3ee0bf9705f19726e0d298f94dc049652a4fbe78 · artifact f698956b8972469f9c2184f8a869728715a19a85 · GitHub Actions run 35213784067 PASS · production descendant fa9de16de39b09a5075ee2db2205b182900fa380 · Vercel dpl_41a1wTGhRPiBPPvYo4aAczszLJqx READY · production HTTP 200/runtime clean",
  "32.07": "docs/32_07_APPEND_ONLY_GAP_IDS.md · implementation fdd88ba2421ec5774d8cf7140d4c192d36a42873 · GitHub Actions run 35214678819 PASS · append-only invariant/self-tests PASS · production descendant fa9de16de39b09a5075ee2db2205b182900fa380 · Vercel dpl_41a1wTGhRPiBPPvYo4aAczszLJqx READY · production HTTP 200/runtime clean",
  "32.08": "docs/32_08_STATUS_HISTORY_AUDIT_TRAIL.md · implementation 82701485d2b1295e73389b4c37c4c468a849441b · verification fix 2ece07a407f466d388478fc30295913a992ae15b · GitHub Actions run 35244922187 PASS · audit invariant/self-tests PASS · Vercel dpl_G7453s1yPtnTL4p17vDKwHCkiXSy READY · production HTTP 200/runtime clean",
  "32.09": "docs/32_09_CLOUD_REALTIME_STATUS_STORE.md · implementation cc2d21fbeaa2ab2fc77317821c134ac56c459bc4 · workflow 78bf6ce3eb197b73b489664421587ec2d43e1955 · GitHub Actions run 35246234986 PASS · cloud sync/read-back PASS rows=18 · Supabase enchev_plan_state RLS + OIDC Edge Function · Vercel dpl_5AAojnTphZbr5ZySixWUtQ4wRgyU READY · production HTTP 200/runtime clean",
  "32.10": "docs/32_10_PLAN_VERSION_DISPLAYED_IN_UI.md · invariant 8c95cc9cf662fba7e91f724177e7f9829e8403c1 · CI integration c303fe51e4ad53c81a05642a7ffc99b825c62457 · GitHub Actions run 35247299741 PASS · plan-version invariant/self-tests PASS · production HTML 200 shows Master System Plan v1.0 FROZEN · runtime errors 0",
};

export default function VerifiedPlanEvidenceSync() {
  useEffect(() => {
    let timer: number | undefined;

    try {
      const statuses = JSON.parse(localStorage.getItem(STATUS_KEY) || "{}") as Record<string, Status>;
      const notes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}") as Record<string, Note>;
      const stamp = new Date().toISOString();
      let changed = false;

      for (const [id, evidence] of Object.entries(VERIFIED_WAVE_0)) {
        const existing = notes[id] || {};
        const manuallyTouched = Boolean(existing.updatedAt || existing.blocker?.trim() || existing.evidence?.trim());

        // Migrate only untouched legacy/default RED state. Never overwrite a human
        // blocker or a manually edited evidence/status decision.
        if (!manuallyTouched) {
          statuses[id] = "green";
          notes[id] = { evidence, updatedAt: stamp };
          changed = true;
        }
      }

      if (!changed) return;

      localStorage.setItem(STATUS_KEY, JSON.stringify(statuses));
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

      timer = window.setTimeout(() => {
        try {
          const channel = new BroadcastChannel(CHANNEL_KEY);
          channel.postMessage({ type: "state", statuses, notes });
          channel.close();
        } catch {}
      }, 50);
    } catch {}

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
