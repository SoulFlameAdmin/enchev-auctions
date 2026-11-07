/**
 * Strict Enchev data isolation.
 * Preview and local development may never target production Enchev data.
 * Values are public project identifiers, not credentials.
 * The application must fail closed when the deployment target is unknown.
 */
export const ENCHEV_PRODUCTION_REF="ejfrnjhlggebzmpmxajl" as const;
export const ENCHEV_STAGING_REF="jranctnafndbqzrwcwos" as const;

export function expectedEnchevRef(
  deploymentEnv=process.env.VERCEL_ENV,
  nodeEnv=process.env.NODE_ENV,
):string|null{
  if(deploymentEnv==="production")return ENCHEV_PRODUCTION_REF;
  if(deploymentEnv==="preview"||deploymentEnv==="development")return ENCHEV_STAGING_REF;
  // Never infer a production database merely from NODE_ENV=production.
  if(!deploymentEnv && nodeEnv==="development")return ENCHEV_STAGING_REF;
  return null;
}

export function projectBindingIsValid(url:string|undefined,ref:string|undefined,expected:string|null){
  if(!expected||!ref||!url||ref!==expected)return false;
  try{
    const parsed=new URL(url);
    return parsed.protocol==="https:"&&
      parsed.host===expected+".supabase.co"&&
      parsed.pathname==="/"&&
      !parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash;
  }catch{return false;}
}
