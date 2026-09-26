export type WorkspaceSections = Readonly<Record<string, readonly string[]>>;

export type BuyerWorkspaceSyncSnapshot = Readonly<{
  userId: string;
  revision: number;
  updatedAt: string;
  sections: WorkspaceSections;
  appliedMutationIds: readonly string[];
}>;

export type WorkspaceSyncOperation = Readonly<{
  section: string;
  action: "add" | "remove";
  itemId: string;
}>;

export type WorkspaceSyncMutation = Readonly<{
  userId: string;
  deviceId: string;
  mutationId: string;
  expectedRevision: number;
  occurredAt: string;
  operations: readonly WorkspaceSyncOperation[];
}>;

function required(value:string,code:string):string{
  const normalized=value.trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function iso(value:string,code:string):string{
  const n=Date.parse(value);
  if(!Number.isFinite(n)) throw new Error(code);
  return new Date(n).toISOString();
}

function positiveInteger(value:number,code:string,allowZero=false):number{
  if(!Number.isInteger(value)||(allowZero?value<0:value<1)) throw new Error(code);
  return value;
}

function canonicalSections(
  input:WorkspaceSections,
  maxSections:number,
  maxEntriesPerSection:number,
):Readonly<Record<string,readonly string[]>>{
  const names=Object.keys(input);
  if(names.length>maxSections) throw new Error("WORKSPACE_SYNC_SECTION_LIMIT_EXCEEDED");
  const out:Record<string,readonly string[]>={};
  for(const rawName of names.sort()){
    const name=required(rawName,"WORKSPACE_SYNC_SECTION_REQUIRED");
    const values=input[rawName]??[];
    if(values.length>maxEntriesPerSection) throw new Error("WORKSPACE_SYNC_ENTRY_LIMIT_EXCEEDED");
    const normalized=values.map(x=>required(x,"WORKSPACE_SYNC_ITEM_REQUIRED"));
    out[name]=Object.freeze([...new Set(normalized)].sort());
  }
  return Object.freeze(out);
}

export function normalizeWorkspaceSyncSnapshot(
  snapshot:BuyerWorkspaceSyncSnapshot,
  maxSections=32,
  maxEntriesPerSection=1000,
  maxAppliedMutationIds=256,
):BuyerWorkspaceSyncSnapshot{
  const userId=required(snapshot.userId,"WORKSPACE_SYNC_USER_REQUIRED");
  const revision=positiveInteger(snapshot.revision,"WORKSPACE_SYNC_REVISION_INVALID",true);
  const updatedAt=iso(snapshot.updatedAt,"WORKSPACE_SYNC_UPDATED_AT_INVALID");
  if(!Number.isInteger(maxSections)||maxSections<1||maxSections>256) throw new Error("WORKSPACE_SYNC_SECTION_LIMIT_INVALID");
  if(!Number.isInteger(maxEntriesPerSection)||maxEntriesPerSection<1||maxEntriesPerSection>10000) throw new Error("WORKSPACE_SYNC_ENTRY_LIMIT_INVALID");
  if(!Number.isInteger(maxAppliedMutationIds)||maxAppliedMutationIds<1||maxAppliedMutationIds>5000) throw new Error("WORKSPACE_SYNC_MUTATION_HISTORY_LIMIT_INVALID");
  const ids=snapshot.appliedMutationIds.map(x=>required(x,"WORKSPACE_SYNC_MUTATION_ID_REQUIRED"));
  return Object.freeze({
    userId,
    revision,
    updatedAt,
    sections:canonicalSections(snapshot.sections,maxSections,maxEntriesPerSection),
    appliedMutationIds:Object.freeze([...new Set(ids)].slice(-maxAppliedMutationIds)),
  });
}

export function applyWorkspaceSyncMutation(
  snapshotInput:BuyerWorkspaceSyncSnapshot,
  mutation:WorkspaceSyncMutation,
  limits:Readonly<{
    maxSections?:number;
    maxEntriesPerSection?:number;
    maxAppliedMutationIds?:number;
    maxOperationsPerMutation?:number;
  }>={},
):BuyerWorkspaceSyncSnapshot{
  const maxSections=limits.maxSections??32;
  const maxEntriesPerSection=limits.maxEntriesPerSection??1000;
  const maxAppliedMutationIds=limits.maxAppliedMutationIds??256;
  const maxOperationsPerMutation=limits.maxOperationsPerMutation??500;
  const snapshot=normalizeWorkspaceSyncSnapshot(snapshotInput,maxSections,maxEntriesPerSection,maxAppliedMutationIds);

  const userId=required(mutation.userId,"WORKSPACE_SYNC_MUTATION_USER_REQUIRED");
  const deviceId=required(mutation.deviceId,"WORKSPACE_SYNC_DEVICE_REQUIRED");
  void deviceId;
  const mutationId=required(mutation.mutationId,"WORKSPACE_SYNC_MUTATION_ID_REQUIRED");
  positiveInteger(mutation.expectedRevision,"WORKSPACE_SYNC_EXPECTED_REVISION_INVALID",true);
  const occurredAt=iso(mutation.occurredAt,"WORKSPACE_SYNC_OCCURRED_AT_INVALID");
  if(userId!==snapshot.userId) throw new Error("WORKSPACE_SYNC_CROSS_USER_REJECTED");
  if(!Number.isInteger(maxOperationsPerMutation)||maxOperationsPerMutation<1||maxOperationsPerMutation>5000) throw new Error("WORKSPACE_SYNC_OPERATION_LIMIT_INVALID");
  if(mutation.operations.length>maxOperationsPerMutation) throw new Error("WORKSPACE_SYNC_OPERATION_LIMIT_EXCEEDED");

  if(snapshot.appliedMutationIds.includes(mutationId)) return snapshot;
  if(mutation.expectedRevision!==snapshot.revision) throw new Error("WORKSPACE_SYNC_REVISION_CONFLICT");

  const sections:Record<string,string[]>={};
  for(const [name,items] of Object.entries(snapshot.sections)) sections[name]=[...items];

  for(const operation of mutation.operations){
    const section=required(operation.section,"WORKSPACE_SYNC_OPERATION_SECTION_REQUIRED");
    const itemId=required(operation.itemId,"WORKSPACE_SYNC_OPERATION_ITEM_REQUIRED");
    if(!(section in sections)){
      if(Object.keys(sections).length>=maxSections) throw new Error("WORKSPACE_SYNC_SECTION_LIMIT_EXCEEDED");
      sections[section]=[];
    }
    const set=new Set(sections[section]);
    if(operation.action==="add") set.add(itemId);
    else if(operation.action==="remove") set.delete(itemId);
    else throw new Error("WORKSPACE_SYNC_OPERATION_ACTION_INVALID");
    if(set.size>maxEntriesPerSection) throw new Error("WORKSPACE_SYNC_ENTRY_LIMIT_EXCEEDED");
    sections[section]=[...set].sort();
  }

  const nextIds=[...snapshot.appliedMutationIds,mutationId].slice(-maxAppliedMutationIds);
  const next:BuyerWorkspaceSyncSnapshot={
    userId:snapshot.userId,
    revision:snapshot.revision+1,
    updatedAt:occurredAt,
    sections,
    appliedMutationIds:nextIds,
  };
  return normalizeWorkspaceSyncSnapshot(next,maxSections,maxEntriesPerSection,maxAppliedMutationIds);
}
