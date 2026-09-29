export const PRODUCTION_FAILURE_CERTIFICATION_VERSION = 1;

function required(value, code) {
  const normalized=String(value??"").trim();
  if(!normalized) throw new Error(code);
  return normalized;
}

function positiveInt(value, code) {
  if(!Number.isInteger(value)||value<1) throw new Error(code);
  return value;
}

export function createProductionFailureCertificationHarness(options={}) {
  const auctionId=required(options.auctionId??"auction-40","PFC_AUCTION_REQUIRED");
  const authoritativeSequence=Number.isInteger(options.authoritativeSequence)?options.authoritativeSequence:20;
  positiveInt(authoritativeSequence,"PFC_SEQUENCE_INVALID");
  const retryBudget=Number.isInteger(options.retryBudget)?options.retryBudget:2;
  if(retryBudget<0||retryBudget>5) throw new Error("PFC_RETRY_BUDGET_INVALID");

  const baseState=()=>({
    auctionId,
    authoritativeSequence,
    biddingEnabled:true,
    finalizationEnabled:true,
    authoritativeWriteEnabled:true,
    readModelAvailable:true,
    providerDegraded:false,
    reconnectRequired:false,
    resyncRequired:false,
    retryable:false,
    retryBudget,
    preservedAcceptedBidIds:["bid-1","bid-2"],
    winnerId:"buyer-2",
    notes:[]
  });

  const freeze=result=>Object.freeze({
    ...result,
    preservedAcceptedBidIds:Object.freeze([...result.preservedAcceptedBidIds]),
    notes:Object.freeze([...result.notes])
  });

  return {
    simulateRealtimeProcessCrashDuringActiveAuction() {
      const s=baseState();
      s.biddingEnabled=false;
      s.reconnectRequired=true;
      s.resyncRequired=true;
      s.notes.push("realtime-crashed","unsafe-bidding-paused","authoritative-state-preserved");
      return freeze(s);
    },

    simulateWorkerCrashDuringActiveAuction() {
      const s=baseState();
      s.authoritativeWriteEnabled=false;
      s.retryable=true;
      s.notes.push("worker-crashed","new-worker-required","accepted-bids-preserved");
      return freeze(s);
    },

    simulateWorkerCrashDuringFinalization() {
      const s=baseState();
      s.finalizationEnabled=false;
      s.authoritativeWriteEnabled=false;
      s.retryable=true;
      s.notes.push("finalization-interrupted","terminal-write-not-partially-committed","resume-from-authoritative-state");
      return freeze(s);
    },

    simulateRedisConnectionLoss() {
      const s=baseState();
      s.biddingEnabled=false;
      s.readModelAvailable=false;
      s.resyncRequired=true;
      s.retryable=true;
      s.notes.push("redis-unavailable","realtime-cache-not-authority","fail-closed");
      return freeze(s);
    },

    simulateDatabaseConnectionInterruption() {
      const s=baseState();
      s.biddingEnabled=false;
      s.finalizationEnabled=false;
      s.authoritativeWriteEnabled=false;
      s.retryable=true;
      s.notes.push("database-unavailable","authoritative-write-blocked","no-local-success");
      return freeze(s);
    },

    simulateObjectStorageOutage() {
      const s=baseState();
      s.providerDegraded=true;
      s.retryable=true;
      s.notes.push("object-storage-unavailable","media-write-deferred","auction-core-authority-intact");
      return freeze(s);
    },

    simulateKycProviderOutage() {
      const s=baseState();
      s.providerDegraded=true;
      s.notes.push("kyc-unavailable","new-verification-blocked","existing-auction-authority-unchanged");
      return freeze(s);
    },

    simulateNotificationProviderOutage() {
      const s=baseState();
      s.providerDegraded=true;
      s.retryable=true;
      s.notes.push("notification-provider-unavailable","delivery-deferred","auction-outcome-unaffected");
      return freeze(s);
    },

    simulateClientOfflineReconnectDuringBidding(clientSequence=authoritativeSequence-1) {
      if(!Number.isInteger(clientSequence)||clientSequence<0) throw new Error("PFC_CLIENT_SEQUENCE_INVALID");
      const s=baseState();
      s.biddingEnabled=false;
      s.reconnectRequired=true;
      s.resyncRequired=clientSequence!==authoritativeSequence;
      s.notes.push("client-offline","bid-controls-disabled");
      if(s.resyncRequired) s.notes.push("authoritative-resync-before-bidding");
      return freeze(s);
    },

    simulateNetworkPartition({clientSequence=authoritativeSequence-2, serverReachable=false}={}) {
      if(!Number.isInteger(clientSequence)||clientSequence<0) throw new Error("PFC_PARTITION_SEQUENCE_INVALID");
      const s=baseState();
      s.biddingEnabled=false;
      s.authoritativeWriteEnabled=Boolean(serverReachable);
      s.reconnectRequired=true;
      s.resyncRequired=true;
      s.notes.push("network-partition","split-brain-prevented","client-cannot-self-authorize");
      return freeze(s);
    },

    simulateDuplicateEventDelivery({eventId="evt-duplicate-21",sequence=authoritativeSequence+1}={}) {
      const id=required(eventId,"PFC_DUPLICATE_EVENT_ID_REQUIRED");
      if(!Number.isInteger(sequence)||sequence!==authoritativeSequence+1) throw new Error("PFC_DUPLICATE_SEQUENCE_INVALID");
      const s=baseState();
      s.authoritativeSequence=sequence;
      s.duplicateIgnored=true;
      s.appliedEventIds=Object.freeze([id]);
      s.notes.push("first-delivery-applied","duplicate-delivery-idempotent-ignore","no-second-authoritative-mutation");
      return freeze(s);
    },

    simulateOutOfOrderEventDelivery({receivedSequence=authoritativeSequence+2}={}) {
      if(!Number.isInteger(receivedSequence)||receivedSequence<=authoritativeSequence+1) throw new Error("PFC_OUT_OF_ORDER_SEQUENCE_INVALID");
      const s=baseState();
      s.biddingEnabled=false;
      s.resyncRequired=true;
      s.bufferedSequences=Object.freeze([receivedSequence]);
      s.expectedSequence=authoritativeSequence+1;
      s.notes.push("out-of-order-event-detected","event-not-applied","authoritative-resync-required");
      return freeze(s);
    },

    simulateSequenceGapRecovery({receivedSequence=authoritativeSequence+3,snapshotSequence=receivedSequence}={}) {
      if(!Number.isInteger(receivedSequence)||receivedSequence<=authoritativeSequence+1) throw new Error("PFC_GAP_RECEIVED_SEQUENCE_INVALID");
      if(!Number.isInteger(snapshotSequence)||snapshotSequence<receivedSequence) throw new Error("PFC_GAP_SNAPSHOT_SEQUENCE_INVALID");
      const s=baseState();
      s.biddingEnabled=false;
      s.resyncRequired=true;
      s.expectedSequence=authoritativeSequence+1;
      s.receivedSequence=receivedSequence;
      s.notes.push("sequence-gap-detected","unsafe-bidding-paused","authoritative-snapshot-requested");
      const recovered={...s};
      recovered.authoritativeSequence=snapshotSequence;
      recovered.biddingEnabled=true;
      recovered.resyncRequired=false;
      recovered.snapshotApplied=true;
      recovered.notes=[...s.notes,"authoritative-snapshot-applied","sequence-gap-recovered"];
      return freeze(recovered);
    },

    simulateStaleCacheRecovery({cacheSequence=authoritativeSequence-2,snapshotSequence=authoritativeSequence}={}) {
      if(!Number.isInteger(cacheSequence)||cacheSequence<0) throw new Error("PFC_CACHE_SEQUENCE_INVALID");
      if(cacheSequence>=authoritativeSequence) throw new Error("PFC_CACHE_NOT_STALE");
      if(!Number.isInteger(snapshotSequence)||snapshotSequence<authoritativeSequence) throw new Error("PFC_CACHE_SNAPSHOT_SEQUENCE_INVALID");
      const s=baseState();
      s.biddingEnabled=false;
      s.readModelAvailable=false;
      s.resyncRequired=true;
      s.cacheSequence=cacheSequence;
      s.notes.push("stale-cache-detected","cache-discarded","authoritative-snapshot-requested");
      const recovered={...s};
      recovered.authoritativeSequence=snapshotSequence;
      recovered.cacheSequence=snapshotSequence;
      recovered.biddingEnabled=true;
      recovered.readModelAvailable=true;
      recovered.resyncRequired=false;
      recovered.cacheDiscarded=true;
      recovered.snapshotApplied=true;
      recovered.notes=[...s.notes,"authoritative-cache-rebuilt"];
      return freeze(recovered);
    },

    simulateClockSkew({clientNowMs,authoritativeNowMs,deadlineMs}) {
      for(const [value,code] of [[clientNowMs,"PFC_CLIENT_CLOCK_INVALID"],[authoritativeNowMs,"PFC_AUTH_CLOCK_INVALID"],[deadlineMs,"PFC_DEADLINE_INVALID"]]) {
        if(!Number.isSafeInteger(value)) throw new Error(code);
      }
      const s=baseState();
      const authoritativeAccepted=authoritativeNowMs<=deadlineMs;
      const clientWouldAccept=clientNowMs<=deadlineMs;
      s.biddingEnabled=authoritativeAccepted;
      s.clientClockIgnored=true;
      s.clockSkewMs=clientNowMs-authoritativeNowMs;
      s.authoritativeDecision=authoritativeAccepted?"accept":"reject-late-operation";
      s.clientDecision=clientWouldAccept?"accept":"reject-late-operation";
      s.notes.push("client-clock-ignored","authoritative-clock-decides");
      if(authoritativeAccepted!==clientWouldAccept) s.notes.push("clock-skew-decision-divergence-contained");
      return freeze(s);
    },

    recover(result, nextAuthoritativeSequence=authoritativeSequence) {
      if(!result||typeof result!=="object") throw new Error("PFC_RESULT_REQUIRED");
      if(!Number.isInteger(nextAuthoritativeSequence)||nextAuthoritativeSequence<result.authoritativeSequence) {
        throw new Error("PFC_RECOVERY_SEQUENCE_REGRESSION");
      }
      const recovered={...result};
      recovered.authoritativeSequence=nextAuthoritativeSequence;
      recovered.biddingEnabled=true;
      recovered.finalizationEnabled=true;
      recovered.authoritativeWriteEnabled=true;
      recovered.readModelAvailable=true;
      recovered.providerDegraded=false;
      recovered.reconnectRequired=false;
      recovered.resyncRequired=false;
      recovered.retryable=false;
      recovered.notes=[...result.notes,"recovered-from-authoritative-state"];
      return freeze(recovered);
    }
  };
}
