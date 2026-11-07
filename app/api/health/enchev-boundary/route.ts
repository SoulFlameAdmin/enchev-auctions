import {expectedEnchevRef,projectBindingIsValid} from "../../../lib/enchev-runtime-isolation";
import {enchevLegalStatus} from "../../../lib/enchev-legal";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

// Secret-safe D003 preflight. This endpoint does NOT authenticate to Supabase,
// test DB role grants or authorize staging writes/real money. No credentials,
// project URLs, business identities or user data ever appear in the response.
export async function GET(){
  const expected=expectedEnchevRef();
  const environment=process.env.VERCEL_ENV==="production"?"production"
    :process.env.VERCEL_ENV==="preview"?"preview"
    :"unknown";
  const authConfigured=Boolean(
    process.env.ENCHEV_AUTH_URL &&
    process.env.ENCHEV_AUTH_PROJECT_REF &&
    process.env.ENCHEV_AUTH_ANON_KEY
  );
  const authBindingValid=authConfigured && projectBindingIsValid(
    process.env.ENCHEV_AUTH_URL,
    process.env.ENCHEV_AUTH_PROJECT_REF,
    expected
  );
  const etap1Configured=Boolean(
    process.env.ENCHEV_ETAP1_SUPABASE_URL &&
    process.env.ENCHEV_ETAP1_PROJECT_REF &&
    process.env.ENCHEV_ETAP1_SERVICE_ROLE_KEY
  );
  const etap1BindingValid=etap1Configured && projectBindingIsValid(
    process.env.ENCHEV_ETAP1_SUPABASE_URL,
    process.env.ENCHEV_ETAP1_PROJECT_REF,
    expected
  );
  const legalApproved=enchevLegalStatus().approved;
  const ready=environment!=="unknown" && authBindingValid && etap1BindingValid;
  return Response.json({
    ok:ready,
    component:"enchev-environment-isolation",
    environment,
    projectBoundaryGuardActive:true,
    expectedTarget:environment==="production"?"dedicated-enchev-production":environment==="preview"?"isolated-enchev-staging":"unknown",
    identity:{
      configured:authConfigured,
      bindingMatchesEnvironment:authBindingValid,
      enabled:process.env.ENCHEV_AUTH_ENABLED==="true",
      legalGateApproved:legalApproved
    },
    etap1:{
      configured:etap1Configured,
      bindingMatchesEnvironment:etap1BindingValid
    },
    configPreflightReady:ready,
    d003Accepted:false,
    reason:ready
      ?"Configuration names and expected target match; role/branch/negative tests remain mandatory."
      :"D003 remains BLOCKED: environment-scoped bindings missing, inconsistent or unknown.",
    noCredentialsExposed:true,
    liveMoneyAuthorized:false,
  },{status:ready?200:503,headers:{"Cache-Control":"no-store, max-age=0","X-Robots-Tag":"noindex"}});
}
