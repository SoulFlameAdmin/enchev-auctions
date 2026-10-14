// The imported cinematic runtime is stored as a compressed frontend archive.
// Patch its provider (rather than removing React-owned DOM) so a failed media
// readiness signal cannot permanently block navigation or scroll animations.
export function recoverForgeLoader(frontend) {
  const file = '_next/static/chunks/1glnxab0mgbi5.js';
  const needle = '[u,d]=(0,r.useState)(h),[p,m]=(0,r.useState)(h);';
  const replacement = needle + '(0,r.useEffect)(()=>{if(!h)return;const timer=window.setTimeout(()=>{d(!1);m(!1)},8000);return()=>window.clearTimeout(timer)},[h]);';
  if (frontend[file]?.split(needle).length !== 2) {
    throw new Error('Forge LoaderProvider changed; review recovery patch before publishing');
  }
  return { ...frontend, [file]: frontend[file].replace(needle, replacement) };
}
