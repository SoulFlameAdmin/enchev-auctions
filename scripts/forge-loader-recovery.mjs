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
  const loaderFile = '_next/static/chunks/414eipoaws2vq.js';
  const loaderNeedle = '[W,X]=(0,s.useState)(!1);';
  if (frontend[loaderFile]?.split(loaderNeedle).length !== 2) {
    throw new Error('Forge Loader changed; review recovery patch before publishing');
  }
  // The GSAP exit timeline can also stall in throttled/WebGL-limited browsers.
  // Unmount via React state directly; never delete nodes owned by React.
  const loaderReplacement = loaderNeedle + '(0,s.useEffect)(()=>{const timer=window.setTimeout(()=>{X(!0);A(!1)},8000);return()=>window.clearTimeout(timer)},[A]);';
  return {
    ...frontend,
    [file]: frontend[file].replace(needle, replacement),
    [loaderFile]: frontend[loaderFile].replace(loaderNeedle, loaderReplacement),
  };
}
