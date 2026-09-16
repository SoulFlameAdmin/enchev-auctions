export function isAuthorizedWorkflow(claims: Record<string, unknown>): boolean {
 const repository='SoulFlameAdmin/enchev-auctions',ref=String(claims.ref||'');
 return claims.repository_id==='1373693893' && claims.repository_owner_id==='175710990' && claims.repository===repository && ['refs/heads/main','refs/heads/staging'].includes(ref) && ['push','workflow_dispatch'].includes(String(claims.event_name)) && claims.workflow_ref===`${repository}/.github/workflows/ci.yml@${ref}` && /^[a-f0-9]{40}$/.test(String(claims.sha)) && /^\d+$/.test(String(claims.run_id));
}
