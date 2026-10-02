import { isIP } from "node:net";

export type OutboundUrlPolicy = Readonly<{
  allowedHosts: readonly string[];
  allowedPorts: readonly number[];
  maxRedirects: number;
  httpsOnly: true;
  requireResolvedAddresses: true;
  manualRedirectHandlingRequired: true;
}>;

export type ValidatedOutboundTarget = Readonly<{
  url: string;
  protocol: "https:";
  hostname: string;
  port: number;
  resolvedAddresses: readonly string[];
}>;

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}
function positiveInt(value:number,code:string):number{
  if(!Number.isSafeInteger(value)||value<1) throw new Error(code);
  return value;
}
function nonNegativeInt(value:number,code:string):number{
  if(!Number.isSafeInteger(value)||value<0) throw new Error(code);
  return value;
}
function stripBrackets(hostname:string):string{
  return hostname.startsWith("[")&&hostname.endsWith("]")?hostname.slice(1,-1):hostname;
}
function isBlockedHostname(hostname:string):boolean{
  const h=hostname.toLowerCase();
  return h==="localhost"
    || h.endsWith(".localhost")
    || h.endsWith(".local")
    || h.endsWith(".internal")
    || h.endsWith(".lan")
    || h.endsWith(".home")
    || h==="metadata.google.internal";
}
function normalizeHost(host:string):string{
  const h=required(host,"SSRF_ALLOWED_HOST_REQUIRED").toLowerCase();
  if(h.endsWith(".")) throw new Error("SSRF_TRAILING_DOT_HOST_FORBIDDEN");
  if(isIP(stripBrackets(h))!==0) throw new Error("SSRF_ALLOWED_HOST_IP_LITERAL_FORBIDDEN");
  if(isBlockedHostname(h)) throw new Error("SSRF_BLOCKED_HOSTNAME");
  if(!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(h)||!h.includes(".")) throw new Error("SSRF_ALLOWED_HOST_INVALID");
  return h;
}
function parseIpv4(address:string):readonly number[]{
  const parts=address.split(".");
  if(parts.length!==4) throw new Error("SSRF_IPV4_INVALID");
  const nums=parts.map(part=>{
    if(!/^\d{1,3}$/.test(part)) throw new Error("SSRF_IPV4_INVALID");
    const n=Number(part);
    if(n<0||n>255) throw new Error("SSRF_IPV4_INVALID");
    return n;
  });
  return Object.freeze(nums);
}
function isPublicIpv4(address:string):boolean{
  const [a,b,c,d]=parseIpv4(address);
  if(a===0||a===10||a===127) return false;
  if(a===100&&b>=64&&b<=127) return false;
  if(a===169&&b===254) return false;
  if(a===172&&b>=16&&b<=31) return false;
  if(a===192&&b===0&&c===0) return false;
  if(a===192&&b===0&&c===2) return false;
  if(a===192&&b===168) return false;
  if(a===198&&(b===18||b===19)) return false;
  if(a===198&&b===51&&c===100) return false;
  if(a===203&&b===0&&c===113) return false;
  if(a>=224) return false;
  if(a===255&&b===255&&c===255&&d===255) return false;
  return true;
}
function expandIpv6(address:string):readonly number[]{
  const raw=address.toLowerCase();
  if(raw.includes("%")) throw new Error("SSRF_IPV6_ZONE_ID_FORBIDDEN");
  let source=raw;
  if(source.includes(".")){
    const lastColon=source.lastIndexOf(":");
    if(lastColon<0) throw new Error("SSRF_IPV6_INVALID");
    const ipv4=parseIpv4(source.slice(lastColon+1));
    const hi=((ipv4[0]<<8)|ipv4[1]).toString(16);
    const lo=((ipv4[2]<<8)|ipv4[3]).toString(16);
    source=source.slice(0,lastColon)+":"+hi+":"+lo;
  }
  const halves=source.split("::");
  if(halves.length>2) throw new Error("SSRF_IPV6_INVALID");
  const left=halves[0]?halves[0].split(":"):[];
  const right=halves.length===2&&halves[1]?halves[1].split(":"):[];
  const parseGroup=(x:string)=>{
    if(!/^[0-9a-f]{1,4}$/.test(x)) throw new Error("SSRF_IPV6_INVALID");
    return parseInt(x,16);
  };
  const leftGroups=left.map(parseGroup);
  const rightGroups=right.map(parseGroup);
  if(halves.length===1){
    if(leftGroups.length!==8) throw new Error("SSRF_IPV6_INVALID");
    return Object.freeze(leftGroups);
  }
  const missing=8-leftGroups.length-rightGroups.length;
  if(missing<1) throw new Error("SSRF_IPV6_INVALID");
  return Object.freeze([...leftGroups,...Array(missing).fill(0),...rightGroups]);
}
function isPublicIpv6(address:string):boolean{
  const g=expandIpv6(address);
  const allZero=g.every(x=>x===0);
  if(allZero) return false;
  if(g.slice(0,7).every(x=>x===0)&&g[7]===1) return false;
  if((g[0]&0xfe00)===0xfc00) return false;
  if((g[0]&0xffc0)===0xfe80) return false;
  if((g[0]&0xffc0)===0xfec0) return false;
  if((g[0]&0xff00)===0xff00) return false;
  if(g[0]===0x2001&&g[1]===0x0db8) return false;
  if(g[0]===0x2001&&g[1]===0x0000) return false;
  if(g[0]===0x2002) return false;
  if(g[0]===0x0064&&g[1]===0xff9b&&g.slice(2,6).every(x=>x===0)) return false;
  if(g[0]===0x0100&&g.slice(1,4).every(x=>x===0)) return false;
  const mapped=g.slice(0,5).every(x=>x===0)&&g[5]===0xffff;
  if(mapped){
    const ipv4=[g[6]>>8,g[6]&255,g[7]>>8,g[7]&255].join(".");
    return isPublicIpv4(ipv4);
  }
  return true;
}
export function isPublicOutboundAddress(addressInput:string):boolean{
  const address=stripBrackets(required(addressInput,"SSRF_RESOLVED_ADDRESS_REQUIRED")).toLowerCase();
  const family=isIP(address);
  if(family===4) return isPublicIpv4(address);
  if(family===6) return isPublicIpv6(address);
  throw new Error("SSRF_RESOLVED_ADDRESS_INVALID");
}
export function validateOutboundUrlPolicy(policy:OutboundUrlPolicy):OutboundUrlPolicy{
  if(policy.httpsOnly!==true) throw new Error("SSRF_HTTPS_ONLY_REQUIRED");
  if(policy.requireResolvedAddresses!==true) throw new Error("SSRF_RESOLUTION_REQUIRED");
  if(policy.manualRedirectHandlingRequired!==true) throw new Error("SSRF_MANUAL_REDIRECT_REQUIRED");
  const allowedHosts=policy.allowedHosts.map(normalizeHost);
  if(allowedHosts.length<1) throw new Error("SSRF_ALLOWLIST_REQUIRED");
  if(new Set(allowedHosts).size!==allowedHosts.length) throw new Error("SSRF_ALLOWLIST_DUPLICATE");
  const allowedPorts=policy.allowedPorts.map(x=>positiveInt(x,"SSRF_ALLOWED_PORT_INVALID"));
  if(allowedPorts.length<1||allowedPorts.some(x=>x>65535)) throw new Error("SSRF_ALLOWED_PORT_INVALID");
  if(new Set(allowedPorts).size!==allowedPorts.length) throw new Error("SSRF_ALLOWED_PORT_DUPLICATE");
  const maxRedirects=nonNegativeInt(policy.maxRedirects,"SSRF_REDIRECT_LIMIT_INVALID");
  return Object.freeze({
    allowedHosts:Object.freeze(allowedHosts),
    allowedPorts:Object.freeze([...allowedPorts]),
    maxRedirects,
    httpsOnly:true,
    requireResolvedAddresses:true,
    manualRedirectHandlingRequired:true,
  });
}
function parseCandidate(urlInput:string,policy:OutboundUrlPolicy):Readonly<{url:URL;hostname:string;port:number}>{
  const raw=required(urlInput,"SSRF_URL_REQUIRED");
  let url:URL;
  try{url=new URL(raw);}catch{throw new Error("SSRF_URL_INVALID");}
  if(url.protocol!=="https:") throw new Error("SSRF_SCHEME_FORBIDDEN");
  if(url.username||url.password) throw new Error("SSRF_USERINFO_FORBIDDEN");
  if(url.hash) throw new Error("SSRF_FRAGMENT_FORBIDDEN");
  const hostname=stripBrackets(url.hostname.toLowerCase());
  if(url.hostname.endsWith(".")) throw new Error("SSRF_TRAILING_DOT_HOST_FORBIDDEN");
  if(isIP(hostname)!==0) throw new Error("SSRF_IP_LITERAL_FORBIDDEN");
  if(isBlockedHostname(hostname)) throw new Error("SSRF_BLOCKED_HOSTNAME");
  if(!policy.allowedHosts.includes(hostname)) throw new Error("SSRF_HOST_NOT_ALLOWLISTED");
  const port=url.port?Number(url.port):443;
  if(!policy.allowedPorts.includes(port)) throw new Error("SSRF_PORT_FORBIDDEN");
  return Object.freeze({url,hostname,port});
}
export function authorizeOutboundTarget(
  urlInput:string,
  resolvedAddressesInput:readonly string[],
  policyInput:OutboundUrlPolicy,
):ValidatedOutboundTarget{
  const policy=validateOutboundUrlPolicy(policyInput);
  const candidate=parseCandidate(urlInput,policy);
  if(!Array.isArray(resolvedAddressesInput)||resolvedAddressesInput.length<1) throw new Error("SSRF_RESOLUTION_EMPTY");
  const addresses=resolvedAddressesInput.map(address=>stripBrackets(required(address,"SSRF_RESOLVED_ADDRESS_REQUIRED")).toLowerCase());
  if(new Set(addresses).size!==addresses.length) throw new Error("SSRF_RESOLUTION_DUPLICATE");
  for(const address of addresses){
    if(!isPublicOutboundAddress(address)) throw new Error("SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
  }
  return Object.freeze({
    url:candidate.url.toString(),
    protocol:"https:",
    hostname:candidate.hostname,
    port:candidate.port,
    resolvedAddresses:Object.freeze(addresses),
  });
}
export function authorizeOutboundRedirect(
  input:Readonly<{
    previous:ValidatedOutboundTarget;
    nextUrl:string;
    nextResolvedAddresses:readonly string[];
    redirectCount:number;
  }>,
  policyInput:OutboundUrlPolicy,
):ValidatedOutboundTarget{
  const policy=validateOutboundUrlPolicy(policyInput);
  const redirectCount=nonNegativeInt(input.redirectCount,"SSRF_REDIRECT_COUNT_INVALID");
  if(redirectCount>=policy.maxRedirects) throw new Error("SSRF_REDIRECT_LIMIT_EXCEEDED");
  if(!input.previous.url) throw new Error("SSRF_PREVIOUS_TARGET_REQUIRED");
  return authorizeOutboundTarget(input.nextUrl,input.nextResolvedAddresses,policy);
}
