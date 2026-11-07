// End-to-end invariant for D003: Preview/Local can NEVER target production data.
// No DB operations and no secrets are needed. Runs in CI on every main/PR build.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const source=readFileSync("app/lib/enchev-runtime-isolation.ts","utf8");
const built=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {expectedEnchevRef,projectBindingIsValid,ENCHEV_PRODUCTION_REF,ENCHEV_STAGING_REF}
  =await import("data:text/javascript;base64,"+Buffer.from(built).toString("base64"));
const productionUrl="https://"+ENCHEV_PRODUCTION_REF+".supabase.co";
const stagingUrl="https://"+ENCHEV_STAGING_REF+".supabase.co";
assert.notEqual(ENCHEV_PRODUCTION_REF,ENCHEV_STAGING_REF);
assert.equal(expectedEnchevRef("production","production"),ENCHEV_PRODUCTION_REF);
assert.equal(expectedEnchevRef("preview","production"),ENCHEV_STAGING_REF);
assert.equal(expectedEnchevRef("development","development"),ENCHEV_STAGING_REF);
assert.equal(expectedEnchevRef("invalid","production"),null);
assert.equal(expectedEnchevRef("unknown","production"),null);
assert.equal(projectBindingIsValid(productionUrl,ENCHEV_PRODUCTION_REF,expectedEnchevRef("production","production")),true);
assert.equal(projectBindingIsValid(stagingUrl,ENCHEV_STAGING_REF,expectedEnchevRef("preview","production")),true);

const rejected=[
 [productionUrl,ENCHEV_PRODUCTION_REF,expectedEnchevRef("preview","production")],
 [stagingUrl,ENCHEV_STAGING_REF,expectedEnchevRef("production","production")],
 ["http://"+ENCHEV_STAGING_REF+".supabase.co",ENCHEV_STAGING_REF,ENCHEV_STAGING_REF],
 ["https://user:pass@"+ENCHEV_STAGING_REF+".supabase.co",ENCHEV_STAGING_REF,ENCHEV_STAGING_REF],
 [stagingUrl+"/rest/v1",ENCHEV_STAGING_REF,ENCHEV_STAGING_REF],
 [stagingUrl+"?x=1",ENCHEV_STAGING_REF,ENCHEV_STAGING_REF],
 [stagingUrl,ENCHEV_PRODUCTION_REF,ENCHEV_STAGING_REF],
 [stagingUrl,ENCHEV_STAGING_REF,null],
 ["https://frhletkiuupgksmgxoxc.supabase.co","frhletkiuupgksmgxoxc",ENCHEV_STAGING_REF],
];
for(const [url,ref,expected] of rejected)
  assert.equal(projectBindingIsValid(url,ref,expected),false,`unsafe project binding accepted ${url}`);

const auth=readFileSync("app/lib/enchev-auth-server.ts","utf8");
assert(auth.includes("projectBindingIsValid(url,expectedRef,expectedEnchevRef())"));
const cloudClient=readFileSync("app/components/CloudPlanStateSync.tsx","utf8");
const sync=readFileSync("scripts/sync-cloud-plan-state.mjs","utf8");
for(const file of [cloudClient,sync]){
  assert(file.includes("https://"+ENCHEV_PRODUCTION_REF+".supabase.co/functions/v1/enchev-plan-state"));
  assert(!file.includes("https://frhletkiuupgksmgxoxc.supabase.co/functions/v1/enchev-plan-state"));
}
console.log("ENCHEV_RUNTIME_ISOLATION PASS positive=7 negative="+rejected.length+" plan_target=Enchev");
