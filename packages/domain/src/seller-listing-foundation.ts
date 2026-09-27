export type SellerListingWizardStep = "vehicle" | "condition" | "media" | "pricing" | "review";
export type SellerListingMediaKind = "exterior-photo" | "interior-photo" | "vin-photo" | "video" | "document";

export type SellerListingMedia = Readonly<{
  id: string;
  kind: SellerListingMediaKind;
  uri: string;
  order: number;
}>;

export type SellerListingDraft = Readonly<{
  listingId: string;
  sellerId: string;
  vehicleId: string;
  revision: number;
  updatedAt: string;
  wizardStep: SellerListingWizardStep;
  fields: Readonly<Record<string,string>>;
  media: readonly SellerListingMedia[];
  appliedMutationIds: readonly string[];
}>;

export type SellerListingRequirements = Readonly<{
  vehicleFields: readonly string[];
  conditionFields: readonly string[];
  pricingFields: readonly string[];
  requiredMediaKinds: readonly SellerListingMediaKind[];
}>;

export type SellerListingReadiness = Readonly<{
  ready: boolean;
  missing: readonly string[];
}>;

export type SellerListingAutosave = Readonly<{
  sellerId: string;
  mutationId: string;
  expectedRevision: number;
  occurredAt: string;
  wizardStep?: SellerListingWizardStep;
  fields?: Readonly<Record<string,string|null>>;
  media?: readonly SellerListingMedia[];
}>;

export type SellerListingPreview = Readonly<{
  listingId: string;
  vehicleId: string;
  revision: number;
  fields: Readonly<Record<string,string>>;
  media: readonly SellerListingMedia[];
  fieldReadiness: SellerListingReadiness;
  mediaReadiness: SellerListingReadiness;
  submitReady: boolean;
}>;

export type VehicleQuestion = Readonly<{
  questionId: string;
  vehicleId: string;
  askerUserId: string;
  body: string;
  createdAt: string;
  status: "published" | "hidden";
}>;

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function iso(value:string,code:string):string{
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)) throw new Error(code);
  return new Date(ms).toISOString();
}

function unique(values:readonly string[],code:string):readonly string[]{
  const normalized=values.map(x=>required(x,code));
  if(new Set(normalized).size!==normalized.length) throw new Error(code+"_DUPLICATE");
  return Object.freeze([...normalized]);
}

function normalizeMedia(media:readonly SellerListingMedia[]):readonly SellerListingMedia[]{
  const normalized=media.map(item=>{
    const id=required(item.id,"SELLER_LISTING_MEDIA_ID_REQUIRED");
    const uri=required(item.uri,"SELLER_LISTING_MEDIA_URI_REQUIRED");
    if(!Number.isInteger(item.order)||item.order<0||item.order>100000) throw new Error("SELLER_LISTING_MEDIA_ORDER_INVALID");
    return Object.freeze({...item,id,uri});
  });
  if(new Set(normalized.map(x=>x.id)).size!==normalized.length) throw new Error("SELLER_LISTING_MEDIA_ID_DUPLICATE");
  return Object.freeze(normalized.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)));
}

function normalizeFields(fields:Readonly<Record<string,string>>):Readonly<Record<string,string>>{
  const out:Record<string,string>={};
  for(const [key,value] of Object.entries(fields)){
    const normalizedKey=required(key,"SELLER_LISTING_FIELD_KEY_REQUIRED");
    const normalizedValue=required(value,"SELLER_LISTING_FIELD_VALUE_REQUIRED");
    out[normalizedKey]=normalizedValue;
  }
  return Object.freeze(Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b))));
}

export function normalizeSellerListingDraft(input:SellerListingDraft):SellerListingDraft{
  const listingId=required(input.listingId,"SELLER_LISTING_ID_REQUIRED");
  const sellerId=required(input.sellerId,"SELLER_LISTING_SELLER_REQUIRED");
  const vehicleId=required(input.vehicleId,"SELLER_LISTING_VEHICLE_REQUIRED");
  if(!Number.isInteger(input.revision)||input.revision<0) throw new Error("SELLER_LISTING_REVISION_INVALID");
  const updatedAt=iso(input.updatedAt,"SELLER_LISTING_UPDATED_AT_INVALID");
  const appliedMutationIds=unique(input.appliedMutationIds,"SELLER_LISTING_MUTATION_ID_REQUIRED").slice(-256);
  return Object.freeze({
    ...input,listingId,sellerId,vehicleId,updatedAt,
    fields:normalizeFields(input.fields),
    media:normalizeMedia(input.media),
    appliedMutationIds:Object.freeze([...appliedMutationIds]),
  });
}

export function requiredSellerListingFields(
  draftInput:SellerListingDraft,
  requiredFields:readonly string[],
):SellerListingReadiness{
  const draft=normalizeSellerListingDraft(draftInput);
  const requiredList=unique(requiredFields,"SELLER_LISTING_REQUIRED_FIELD");
  const missing=requiredList.filter(key=>!draft.fields[key]?.trim()).sort();
  return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing)});
}

export function requiredSellerListingMedia(
  draftInput:SellerListingDraft,
  requiredKinds:readonly SellerListingMediaKind[],
):SellerListingReadiness{
  const draft=normalizeSellerListingDraft(draftInput);
  const kinds=new Set(draft.media.map(x=>x.kind));
  const requiredList=[...new Set(requiredKinds)];
  const missing=requiredList.filter(kind=>!kinds.has(kind)).map(kind=>"media:"+kind).sort();
  return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing)});
}

export function sellerListingWizardState(
  draftInput:SellerListingDraft,
  requirements:SellerListingRequirements,
):Readonly<{current:SellerListingWizardStep;canAdvance:boolean;next:SellerListingWizardStep|null;blockers:readonly string[]}>{
  const draft=normalizeSellerListingDraft(draftInput);
  const steps:SellerListingWizardStep[]=["vehicle","condition","media","pricing","review"];
  const index=steps.indexOf(draft.wizardStep);
  if(index<0) throw new Error("SELLER_LISTING_WIZARD_STEP_INVALID");
  let readiness:SellerListingReadiness={ready:true,missing:[]};
  if(draft.wizardStep==="vehicle") readiness=requiredSellerListingFields(draft,requirements.vehicleFields);
  if(draft.wizardStep==="condition") readiness=requiredSellerListingFields(draft,requirements.conditionFields);
  if(draft.wizardStep==="media") readiness=requiredSellerListingMedia(draft,requirements.requiredMediaKinds);
  if(draft.wizardStep==="pricing") readiness=requiredSellerListingFields(draft,requirements.pricingFields);
  return Object.freeze({
    current:draft.wizardStep,
    canAdvance:readiness.ready,
    next:index===steps.length-1?null:steps[index+1],
    blockers:Object.freeze([...readiness.missing]),
  });
}

export function autosaveSellerListingDraft(
  currentInput:SellerListingDraft,
  mutation:SellerListingAutosave,
):SellerListingDraft{
  const current=normalizeSellerListingDraft(currentInput);
  const sellerId=required(mutation.sellerId,"SELLER_LISTING_AUTOSAVE_SELLER_REQUIRED");
  const mutationId=required(mutation.mutationId,"SELLER_LISTING_AUTOSAVE_MUTATION_REQUIRED");
  if(sellerId!==current.sellerId) throw new Error("SELLER_LISTING_AUTOSAVE_CROSS_SELLER");
  if(current.appliedMutationIds.includes(mutationId)) return current;
  if(!Number.isInteger(mutation.expectedRevision)||mutation.expectedRevision!==current.revision) throw new Error("SELLER_LISTING_AUTOSAVE_REVISION_CONFLICT");
  const occurredAt=iso(mutation.occurredAt,"SELLER_LISTING_AUTOSAVE_TIME_INVALID");

  const nextFields:Record<string,string>={...current.fields};
  for(const [key,value] of Object.entries(mutation.fields??{})){
    const normalizedKey=required(key,"SELLER_LISTING_FIELD_KEY_REQUIRED");
    if(value===null){delete nextFields[normalizedKey];continue;}
    nextFields[normalizedKey]=required(value,"SELLER_LISTING_FIELD_VALUE_REQUIRED");
  }

  return normalizeSellerListingDraft({
    ...current,
    revision:current.revision+1,
    updatedAt:occurredAt,
    wizardStep:mutation.wizardStep??current.wizardStep,
    fields:nextFields,
    media:mutation.media??current.media,
    appliedMutationIds:[...current.appliedMutationIds,mutationId].slice(-256),
  });
}

export function buildSellerListingPreview(
  draftInput:SellerListingDraft,
  requirements:SellerListingRequirements,
):SellerListingPreview{
  const draft=normalizeSellerListingDraft(draftInput);
  const allFields=[...requirements.vehicleFields,...requirements.conditionFields,...requirements.pricingFields];
  const fieldReadiness=requiredSellerListingFields(draft,allFields);
  const mediaReadiness=requiredSellerListingMedia(draft,requirements.requiredMediaKinds);
  return Object.freeze({
    listingId:draft.listingId,
    vehicleId:draft.vehicleId,
    revision:draft.revision,
    fields:draft.fields,
    media:draft.media,
    fieldReadiness,
    mediaReadiness,
    submitReady:fieldReadiness.ready&&mediaReadiness.ready,
  });
}

export function addPublicVehicleQuestion(
  current:readonly VehicleQuestion[],
  input:VehicleQuestion,
  maxQuestions=500,
):readonly VehicleQuestion[]{
  if(!Number.isInteger(maxQuestions)||maxQuestions<1||maxQuestions>5000) throw new Error("VEHICLE_QA_LIMIT_INVALID");
  const questionId=required(input.questionId,"VEHICLE_QA_ID_REQUIRED");
  const vehicleId=required(input.vehicleId,"VEHICLE_QA_VEHICLE_REQUIRED");
  const askerUserId=required(input.askerUserId,"VEHICLE_QA_ASKER_REQUIRED");
  const body=required(input.body.replace(/\s+/g," "),"VEHICLE_QA_BODY_REQUIRED");
  if(body.length>1000) throw new Error("VEHICLE_QA_BODY_TOO_LONG");
  const createdAt=iso(input.createdAt,"VEHICLE_QA_TIME_INVALID");
  if(current.some(x=>x.questionId===questionId)) throw new Error("VEHICLE_QA_ID_DUPLICATE");
  if(current.length>=maxQuestions) throw new Error("VEHICLE_QA_LIMIT");
  const next=[...current,Object.freeze({...input,questionId,vehicleId,askerUserId,body,createdAt})];
  return Object.freeze(next.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.questionId.localeCompare(b.questionId)));
}

export function publicVehicleQuestions(
  current:readonly VehicleQuestion[],
  vehicleIdInput:string,
):readonly VehicleQuestion[]{
  const vehicleId=required(vehicleIdInput,"VEHICLE_QA_VEHICLE_REQUIRED");
  return Object.freeze(current.filter(x=>x.vehicleId===vehicleId&&x.status==="published").sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.questionId.localeCompare(b.questionId)));
}
