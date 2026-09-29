import { normalizeUnicodeText } from "./unicode-normalization";

export const INTERNATIONAL_PROOF_MODEL_VERSION = 1 as const;

export type UnitSystem = "metric" | "imperial";

export type InternationalUnitProfile = Readonly<{
  countryCode: string;
  system: UnitSystem;
  distanceUnit: "km" | "mi";
  massUnit: "kg" | "lb";
}>;

export type ActivationProofState = Readonly<{
  countryCode: string;
  enabled: boolean;
  revision: number;
}>;

const COUNTRY_CODE_PATTERN=/^[A-Z]{2}$/;

function required(value:string,code:string):string{
  const normalized=String(value??"").trim();
  if(!normalized)throw new Error(code);
  return normalized;
}

function countryCode(value:string,code:string):string{
  const normalized=required(value,code);
  if(!COUNTRY_CODE_PATTERN.test(normalized))throw new Error(code);
  return normalized;
}

export function formatLocaleNumber(
  value:number,
  locale:string,
  options:Intl.NumberFormatOptions={}
):string{
  if(!Number.isFinite(value))throw new Error("INTL_NUMBER_VALUE_INVALID");
  const requested=required(locale,"INTL_NUMBER_LOCALE_REQUIRED");
  let canonical:string;
  try{
    const list=Intl.getCanonicalLocales(requested);
    if(list.length!==1)throw new Error();
    canonical=list[0];
  }catch{
    throw new Error("INTL_NUMBER_LOCALE_INVALID");
  }
  return new Intl.NumberFormat(canonical,options).format(value);
}

export function resolveTimeZoneOffsetMinutes(
  instantInput:string|Date,
  timeZoneInput:string
):number{
  const instant=instantInput instanceof Date?new Date(instantInput.getTime()):new Date(instantInput);
  if(!Number.isFinite(instant.getTime()))throw new Error("DST_INSTANT_INVALID");
  const timeZone=required(timeZoneInput,"DST_TIMEZONE_REQUIRED");
  let part:string|undefined;
  try{
    part=new Intl.DateTimeFormat("en-US",{
      timeZone,
      timeZoneName:"longOffset",
      year:"numeric",
      month:"2-digit",
      day:"2-digit",
    }).formatToParts(instant).find(item=>item.type==="timeZoneName")?.value;
  }catch{
    throw new Error("DST_TIMEZONE_INVALID");
  }
  if(part==="GMT"||part==="UTC")return 0;
  const match=/^(?:GMT|UTC)([+-])(\d{2}):(\d{2})$/.exec(part??"");
  if(!match)throw new Error("DST_OFFSET_UNRESOLVED");
  const minutes=Number(match[2])*60+Number(match[3]);
  return match[1]==="-"?-minutes:minutes;
}

export function validateInternationalUnitProfile(
  input:InternationalUnitProfile
):InternationalUnitProfile{
  const code=countryCode(input.countryCode,"UNIT_COUNTRY_INVALID");
  if(input.system!=="metric"&&input.system!=="imperial")throw new Error("UNIT_SYSTEM_INVALID");
  const expectedDistance=input.system==="metric"?"km":"mi";
  const expectedMass=input.system==="metric"?"kg":"lb";
  if(input.distanceUnit!==expectedDistance)throw new Error("UNIT_DISTANCE_PROFILE_MISMATCH");
  if(input.massUnit!==expectedMass)throw new Error("UNIT_MASS_PROFILE_MISMATCH");
  return Object.freeze({...input,countryCode:code});
}

export function formatDistanceFromKilometers(
  kilometers:number,
  profile:InternationalUnitProfile,
  locale:string
):string{
  if(!Number.isFinite(kilometers)||kilometers<0)throw new Error("DISTANCE_VALUE_INVALID");
  const normalized=validateInternationalUnitProfile(profile);
  const value=normalized.system==="metric"?kilometers:kilometers*0.621371192237334;
  return formatLocaleNumber(value,locale,{maximumFractionDigits:1})+" "+normalized.distanceUnit;
}

export function formatMassFromKilograms(
  kilograms:number,
  profile:InternationalUnitProfile,
  locale:string
):string{
  if(!Number.isFinite(kilograms)||kilograms<0)throw new Error("MASS_VALUE_INVALID");
  const normalized=validateInternationalUnitProfile(profile);
  const value=normalized.system==="metric"?kilograms:kilograms*2.2046226218487757;
  return formatLocaleNumber(value,locale,{maximumFractionDigits:1})+" "+normalized.massUnit;
}

export function routeCountryScopedProfile<T extends Readonly<{countryCode:string}>>(
  targetCountryCode:string,
  profiles:readonly T[]
):T|null{
  const target=countryCode(targetCountryCode,"COUNTRY_ROUTE_TARGET_INVALID");
  let match:T|null=null;
  for(const profile of profiles){
    const code=countryCode(profile.countryCode,"COUNTRY_ROUTE_PROFILE_INVALID");
    if(code!==target)continue;
    if(match!==null)throw new Error("COUNTRY_ROUTE_DUPLICATE_PROFILE");
    match=profile;
  }
  return match;
}

type JsonLike=null|boolean|number|string|readonly JsonLike[]|Readonly<{[key:string]:JsonLike}>;

export function normalizeInternationalUserText<T extends JsonLike>(input:T):T{
  const visit=(value:JsonLike):JsonLike=>{
    if(typeof value==="string"){
      const normalized=normalizeUnicodeText(value);
      if(!normalized.ok)throw new Error("USER_TEXT_UNICODE_INVALID");
      return normalized.value;
    }
    if(Array.isArray(value))return Object.freeze(value.map(visit));
    if(value&&typeof value==="object"){
      const out:Record<string,JsonLike>={};
      for(const [key,item] of Object.entries(value)){
        const normalizedKey=normalizeUnicodeText(key);
        if(!normalizedKey.ok)throw new Error("USER_TEXT_KEY_UNICODE_INVALID");
        if(Object.prototype.hasOwnProperty.call(out,normalizedKey.value))throw new Error("USER_TEXT_KEY_COLLISION_AFTER_NORMALIZATION");
        out[normalizedKey.value]=visit(item);
      }
      return Object.freeze(out);
    }
    if(typeof value==="number"&&!Number.isFinite(value))throw new Error("USER_TEXT_JSON_NUMBER_INVALID");
    return value;
  };
  return visit(input) as T;
}

export function transitionCountryActivation(
  current:ActivationProofState,
  next:ActivationProofState
):ActivationProofState{
  const currentCountry=countryCode(current.countryCode,"ACTIVATION_CURRENT_COUNTRY_INVALID");
  const nextCountry=countryCode(next.countryCode,"ACTIVATION_NEXT_COUNTRY_INVALID");
  if(currentCountry!==nextCountry)throw new Error("ACTIVATION_CROSS_COUNTRY_TRANSITION");
  if(!Number.isSafeInteger(current.revision)||current.revision<1)throw new Error("ACTIVATION_CURRENT_REVISION_INVALID");
  if(!Number.isSafeInteger(next.revision)||next.revision!==current.revision+1)throw new Error("ACTIVATION_REVISION_MUST_INCREMENT");
  if(typeof current.enabled!=="boolean"||typeof next.enabled!=="boolean")throw new Error("ACTIVATION_ENABLED_INVALID");
  return Object.freeze({...next,countryCode:nextCountry});
}
