export type InspectionMediaKind =
  | "cold-start-video"
  | "walk-around-video"
  | "engine-audio"
  | "undercarriage-video"
  | "photo";

export type InspectionMediaAsset = Readonly<{
  id: string;
  kind: InspectionMediaKind;
  angle: string;
  uri: string;
  mimeType: string;
  sha256: string;
  bytes: number;
  capturedAt: string;
  order: number;
}>;

export type SellerConditionDeclaration = Readonly<{
  declaredByUserId: string;
  declaredAt: string;
  summary: string;
  knownIssues: readonly string[];
}>;

export type InspectorProvenance = Readonly<{
  inspectorId: string;
  capturedAt: string;
}>;

export type DamagePoint = Readonly<{
  id: string;
  bodyArea: string;
  x: number;
  y: number;
  severity: 1 | 2 | 3 | 4 | 5;
  description: string;
  source: "seller" | "inspector";
}>;

export type ObdDiagnosticCode = Readonly<{
  code: string;
  system: string;
  status: "stored" | "pending" | "permanent";
}>;

export type PaintMeasurement = Readonly<{
  panel: string;
  microns: number;
}>;

export type TireCondition = Readonly<{
  position: "front-left" | "front-right" | "rear-left" | "rear-right" | "spare";
  treadMm: number;
  pressureKpa: number | null;
  condition: "good" | "worn" | "replace";
}>;

export type ComponentCondition = Readonly<{
  group: "glass" | "lights" | "interior";
  item: string;
  status: "good" | "damaged" | "not-tested";
  note: string | null;
}>;

export type InspectionReport = Readonly<{
  reportId: string;
  vehicleId: string;
  version: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  sellerDeclaration: SellerConditionDeclaration;
  inspector: InspectorProvenance;
  media: readonly InspectionMediaAsset[];
  damageMap: readonly DamagePoint[];
  obdCodes: readonly ObdDiagnosticCode[];
  paintMeasurements: readonly PaintMeasurement[];
  tires: readonly TireCondition[];
  components: readonly ComponentCondition[];
}>;

export type InspectionPlaybackPlan = Readonly<{
  assetId: string;
  sourceSha256: string;
  state: "queued" | "ready";
  variants: readonly Readonly<{ height: 360 | 720; outputKey: string }>[];
  manifestUri: string | null;
}>;

export type InspectionModerationEvent = Readonly<{
  reportId: string;
  version: number;
  moderatorId: string;
  action: "approve" | "reject";
  reason: string;
  occurredAt: string;
}>;

export type AiDamageSuggestion = Readonly<{
  suggestionId: string;
  modelRef: string;
  confidence: number;
  point: Readonly<Omit<DamagePoint, "source">>;
}>;

export type InspectionCompletenessRequirements = Readonly<{
  requiredMediaKinds: readonly InspectionMediaKind[];
  requiredPhotoAngles: readonly string[];
  minimumPaintMeasurements: number;
  minimumTires: number;
  requiredComponentGroups: readonly ComponentCondition["group"][];
}>;

export type InspectionCompleteness = Readonly<{
  complete: boolean;
  missing: readonly string[];
}>;

function required(value: string, code: string): string {
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function iso(value: string, code: string): string {
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)) throw new Error(code);
  return new Date(ms).toISOString();
}

function unique(values: readonly string[], code: string): readonly string[] {
  const normalized=values.map(x=>required(x,code));
  if(new Set(normalized).size!==normalized.length) throw new Error(code+"_DUPLICATE");
  return Object.freeze([...normalized].sort());
}

function normalizeMedia(asset: InspectionMediaAsset): InspectionMediaAsset {
  const id=required(asset.id,"INSPECTION_MEDIA_ID_REQUIRED");
  const angle=required(asset.angle,"INSPECTION_MEDIA_ANGLE_REQUIRED");
  const uri=required(asset.uri,"INSPECTION_MEDIA_URI_REQUIRED");
  const mimeType=required(asset.mimeType,"INSPECTION_MEDIA_MIME_REQUIRED");
  if(!/^[a-f0-9]{64}$/i.test(asset.sha256)) throw new Error("INSPECTION_MEDIA_SHA256_INVALID");
  if(!Number.isInteger(asset.bytes)||asset.bytes<1) throw new Error("INSPECTION_MEDIA_BYTES_INVALID");
  if(!Number.isInteger(asset.order)||asset.order<0||asset.order>100000) throw new Error("INSPECTION_MEDIA_ORDER_INVALID");
  const capturedAt=iso(asset.capturedAt,"INSPECTION_MEDIA_TIME_INVALID");
  if(asset.kind==="engine-audio"&&!mimeType.startsWith("audio/")) throw new Error("INSPECTION_ENGINE_AUDIO_MIME_INVALID");
  if(asset.kind!=="engine-audio"&&asset.kind!=="photo"&&!mimeType.startsWith("video/")) throw new Error("INSPECTION_VIDEO_MIME_INVALID");
  if(asset.kind==="photo"&&!mimeType.startsWith("image/")) throw new Error("INSPECTION_PHOTO_MIME_INVALID");
  return Object.freeze({...asset,id,angle,uri,mimeType,capturedAt,sha256:asset.sha256.toLowerCase()});
}

function normalizeDamage(point: DamagePoint): DamagePoint {
  const id=required(point.id,"INSPECTION_DAMAGE_ID_REQUIRED");
  const bodyArea=required(point.bodyArea,"INSPECTION_DAMAGE_AREA_REQUIRED");
  const description=required(point.description,"INSPECTION_DAMAGE_DESCRIPTION_REQUIRED");
  if(!Number.isFinite(point.x)||point.x<0||point.x>1||!Number.isFinite(point.y)||point.y<0||point.y>1) throw new Error("INSPECTION_DAMAGE_COORDINATE_INVALID");
  if(!Number.isInteger(point.severity)||point.severity<1||point.severity>5) throw new Error("INSPECTION_DAMAGE_SEVERITY_INVALID");
  return Object.freeze({...point,id,bodyArea,description});
}

export function orderInspectionMedia(media: readonly InspectionMediaAsset[]): readonly InspectionMediaAsset[] {
  const normalized=media.map(normalizeMedia);
  if(new Set(normalized.map(x=>x.id)).size!==normalized.length) throw new Error("INSPECTION_MEDIA_ID_DUPLICATE");
  return Object.freeze(normalized.sort((a,b)=>a.order-b.order||a.capturedAt.localeCompare(b.capturedAt)||a.id.localeCompare(b.id)));
}

export function normalizeInspectionReport(input: InspectionReport): InspectionReport {
  const reportId=required(input.reportId,"INSPECTION_REPORT_ID_REQUIRED");
  const vehicleId=required(input.vehicleId,"INSPECTION_VEHICLE_ID_REQUIRED");
  if(!Number.isInteger(input.version)||input.version<1) throw new Error("INSPECTION_VERSION_INVALID");

  const declaration=Object.freeze({
    declaredByUserId:required(input.sellerDeclaration.declaredByUserId,"INSPECTION_DECLARER_REQUIRED"),
    declaredAt:iso(input.sellerDeclaration.declaredAt,"INSPECTION_DECLARATION_TIME_INVALID"),
    summary:required(input.sellerDeclaration.summary,"INSPECTION_DECLARATION_SUMMARY_REQUIRED"),
    knownIssues:unique(input.sellerDeclaration.knownIssues,"INSPECTION_DECLARATION_ISSUE_REQUIRED"),
  });

  const inspector=Object.freeze({
    inspectorId:required(input.inspector.inspectorId,"INSPECTION_INSPECTOR_REQUIRED"),
    capturedAt:iso(input.inspector.capturedAt,"INSPECTION_CAPTURE_TIME_INVALID"),
  });

  const media=orderInspectionMedia(input.media);
  const damageMap=Object.freeze(input.damageMap.map(normalizeDamage).sort((a,b)=>a.id.localeCompare(b.id)));
  if(new Set(damageMap.map(x=>x.id)).size!==damageMap.length) throw new Error("INSPECTION_DAMAGE_ID_DUPLICATE");

  const obdCodes=Object.freeze(input.obdCodes.map(code=>{
    const normalized=required(code.code,"INSPECTION_OBD_CODE_REQUIRED").toUpperCase();
    if(!/^[PBCU][0-9A-F]{4}$/.test(normalized)) throw new Error("INSPECTION_OBD_CODE_INVALID");
    return Object.freeze({...code,code:normalized,system:required(code.system,"INSPECTION_OBD_SYSTEM_REQUIRED")});
  }).sort((a,b)=>a.code.localeCompare(b.code)));
  if(new Set(obdCodes.map(x=>x.code+"|"+x.status)).size!==obdCodes.length) throw new Error("INSPECTION_OBD_DUPLICATE");

  const paintMeasurements=Object.freeze(input.paintMeasurements.map(x=>{
    const panel=required(x.panel,"INSPECTION_PAINT_PANEL_REQUIRED");
    if(!Number.isFinite(x.microns)||x.microns<0||x.microns>5000) throw new Error("INSPECTION_PAINT_VALUE_INVALID");
    return Object.freeze({...x,panel});
  }).sort((a,b)=>a.panel.localeCompare(b.panel)));

  const tires=Object.freeze(input.tires.map(x=>{
    if(!Number.isFinite(x.treadMm)||x.treadMm<0||x.treadMm>30) throw new Error("INSPECTION_TIRE_TREAD_INVALID");
    if(x.pressureKpa!==null&&(!Number.isFinite(x.pressureKpa)||x.pressureKpa<0||x.pressureKpa>1000)) throw new Error("INSPECTION_TIRE_PRESSURE_INVALID");
    return Object.freeze({...x});
  }).sort((a,b)=>a.position.localeCompare(b.position)));
  if(new Set(tires.map(x=>x.position)).size!==tires.length) throw new Error("INSPECTION_TIRE_POSITION_DUPLICATE");

  const components=Object.freeze(input.components.map(x=>Object.freeze({
    ...x,
    item:required(x.item,"INSPECTION_COMPONENT_ITEM_REQUIRED"),
    note:x.note===null?null:required(x.note,"INSPECTION_COMPONENT_NOTE_REQUIRED"),
  })).sort((a,b)=>a.group.localeCompare(b.group)||a.item.localeCompare(b.item)));

  return Object.freeze({
    ...input,
    reportId,
    vehicleId,
    sellerDeclaration:declaration,
    inspector,
    media,
    damageMap,
    obdCodes,
    paintMeasurements,
    tires,
    components,
  });
}

export function validateRequiredMediaAngles(
  media: readonly InspectionMediaAsset[],
  requiredAngles: readonly string[],
): Readonly<{complete:boolean;missing:readonly string[]}> {
  const requiredList=unique(requiredAngles,"INSPECTION_REQUIRED_ANGLE");
  const present=new Set(media.map(x=>required(x.angle,"INSPECTION_MEDIA_ANGLE_REQUIRED")));
  const missing=requiredList.filter(x=>!present.has(x));
  return Object.freeze({complete:missing.length===0,missing:Object.freeze(missing)});
}

export function buildInspectionPhotoChecklist(
  media: readonly InspectionMediaAsset[],
  requiredAngles: readonly string[],
): readonly Readonly<{angle:string;mediaId:string|null;complete:boolean}>[] {
  const photos=orderInspectionMedia(media).filter(x=>x.kind==="photo");
  return Object.freeze(unique(requiredAngles,"INSPECTION_REQUIRED_PHOTO_ANGLE").map(angle=>{
    const hit=photos.find(x=>x.angle===angle);
    return Object.freeze({angle,mediaId:hit?.id??null,complete:Boolean(hit)});
  }));
}

export function enqueueInspectionTranscode(assetInput: InspectionMediaAsset): InspectionPlaybackPlan {
  const asset=normalizeMedia(assetInput);
  if(!["cold-start-video","walk-around-video","undercarriage-video"].includes(asset.kind)) throw new Error("INSPECTION_TRANSCODE_VIDEO_REQUIRED");
  return Object.freeze({
    assetId:asset.id,
    sourceSha256:asset.sha256,
    state:"queued",
    variants:Object.freeze([
      Object.freeze({height:360 as const,outputKey:"inspection/"+asset.id+"/360p.m3u8"}),
      Object.freeze({height:720 as const,outputKey:"inspection/"+asset.id+"/720p.m3u8"}),
    ]),
    manifestUri:null,
  });
}

export function completeInspectionTranscode(plan: InspectionPlaybackPlan, manifestUriInput: string): InspectionPlaybackPlan {
  if(plan.state!=="queued") throw new Error("INSPECTION_TRANSCODE_STATE_INVALID");
  const manifestUri=required(manifestUriInput,"INSPECTION_MANIFEST_URI_REQUIRED");
  return Object.freeze({...plan,state:"ready",manifestUri});
}

export function verifyInspectionMediaIntegrity(
  assetInput: InspectionMediaAsset,
  expectedSha256: string,
  expectedBytes: number,
): boolean {
  const asset=normalizeMedia(assetInput);
  if(!/^[a-f0-9]{64}$/i.test(expectedSha256)||!Number.isInteger(expectedBytes)||expectedBytes<1) throw new Error("INSPECTION_INTEGRITY_EXPECTATION_INVALID");
  return asset.sha256===expectedSha256.toLowerCase()&&asset.bytes===expectedBytes;
}

export function createInspectionVersion(previous: InspectionReport | null, candidate: InspectionReport): InspectionReport {
  if(previous!==null){
    const prior=normalizeInspectionReport(previous);
    if(prior.reportId!==candidate.reportId||prior.vehicleId!==candidate.vehicleId) throw new Error("INSPECTION_VERSION_IDENTITY_MISMATCH");
    return normalizeInspectionReport({...candidate,version:prior.version+1});
  }
  return normalizeInspectionReport({...candidate,version:1});
}

export function moderateInspection(
  reportInput: InspectionReport,
  input: Readonly<{moderatorId:string;action:"approve"|"reject";reason:string;occurredAt:string}>,
): Readonly<{report:InspectionReport;event:InspectionModerationEvent}> {
  const report=normalizeInspectionReport(reportInput);
  if(report.status!=="submitted") throw new Error("INSPECTION_MODERATION_SUBMITTED_REQUIRED");
  const event=Object.freeze({
    reportId:report.reportId,
    version:report.version,
    moderatorId:required(input.moderatorId,"INSPECTION_MODERATOR_REQUIRED"),
    action:input.action,
    reason:required(input.reason,"INSPECTION_MODERATION_REASON_REQUIRED"),
    occurredAt:iso(input.occurredAt,"INSPECTION_MODERATION_TIME_INVALID"),
  });
  const next=Object.freeze({...report,status:(input.action==="approve"?"approved":"rejected") as InspectionReport["status"]});
  return Object.freeze({report:next,event});
}

export function recordAiDamageSuggestion(
  reportInput: InspectionReport,
  suggestion: AiDamageSuggestion,
): Readonly<{suggestion:AiDamageSuggestion;authoritativeDamageMap:readonly DamagePoint[]}> {
  const report=normalizeInspectionReport(reportInput);
  const suggestionId=required(suggestion.suggestionId,"INSPECTION_AI_SUGGESTION_ID_REQUIRED");
  const modelRef=required(suggestion.modelRef,"INSPECTION_AI_MODEL_REQUIRED");
  if(!Number.isFinite(suggestion.confidence)||suggestion.confidence<0||suggestion.confidence>1) throw new Error("INSPECTION_AI_CONFIDENCE_INVALID");
  const point=normalizeDamage({...suggestion.point,source:"inspector"});
  const normalizedSuggestion=Object.freeze({...suggestion,suggestionId,modelRef,point:Object.freeze({
    id:point.id,bodyArea:point.bodyArea,x:point.x,y:point.y,severity:point.severity,description:point.description
  })});
  return Object.freeze({suggestion:normalizedSuggestion,authoritativeDamageMap:report.damageMap});
}

export function inspectionCompleteness(
  reportInput: InspectionReport,
  requirements: InspectionCompletenessRequirements,
): InspectionCompleteness {
  const report=normalizeInspectionReport(reportInput);
  const missing:string[]=[];
  const kinds=new Set(report.media.map(x=>x.kind));
  for(const kind of requirements.requiredMediaKinds) if(!kinds.has(kind)) missing.push("media:"+kind);
  const photoCheck=buildInspectionPhotoChecklist(report.media,requirements.requiredPhotoAngles);
  for(const item of photoCheck) if(!item.complete) missing.push("photo:"+item.angle);
  if(report.paintMeasurements.length<requirements.minimumPaintMeasurements) missing.push("paint-measurements");
  if(report.tires.length<requirements.minimumTires) missing.push("tires");
  const groups=new Set(report.components.map(x=>x.group));
  for(const group of requirements.requiredComponentGroups) if(!groups.has(group)) missing.push("component:"+group);
  if(!report.sellerDeclaration.summary) missing.push("seller-declaration");
  if(!report.inspector.inspectorId) missing.push("inspector-provenance");
  return Object.freeze({complete:missing.length===0,missing:Object.freeze(missing.sort())});
}
