// LAS's bounded per-subject MCP admission budget. The framework owns this
// directly; no analytics package, persistent store, global timers or DB.
// A 60-second rolling quota and a 5-second burst circuit protect the Worker.
const BUCKET_MS=5000,MAX_BURST=36;
export const MCP_QOS_BUDGET=Object.freeze({
  max:120,windowMs:60000,blockMs:30000,maxEntries:1024
});

export function createMcpGatewayQos({now=()=>Date.now(),max=120,windowMs=60000,
  blockMs=30000,maxEntries=1024}={}){
  const entries=new Map();
  return function check(key){
    const identity=String(key||'anonymous-unknown').slice(0,256);
    const time=now(),tick=Math.floor(time/BUCKET_MS);
    let state=entries.get(identity);
    if(!state||tick<state.tick)
      state={tick,burst:0,times:[],blockedUntil:0};

    // Refresh LRU for bounded per-isolate memory, without a second timer.
    entries.delete(identity);
    entries.set(identity,state);
    if(entries.size>maxEntries)entries.delete(entries.keys().next().value);

    if(state.blockedUntil>time)
      return {allowed:false,blocked:true,retryAfterMs:state.blockedUntil-time};
    if(state.blockedUntil){
      state={tick,burst:0,times:[],blockedUntil:0};
      entries.set(identity,state);
    }
    if(tick!==state.tick){
      state.tick=tick;
      state.burst=0;
    }

    // Prune old timestamps before admission; never keep more than max
    // successful calls for any one identity.
    state.times=state.times.filter(t=>t<=time&&time-t<windowMs);
    if(state.times.length>=max){
      const retryAfterMs=Math.max(1000,windowMs-(time-state.times[0]));
      return {allowed:false,blocked:false,retryAfterMs};
    }

    // Explicit burst guard replaces a costly advisory segmentation model.
    // No change to HTTP 429/retry semantics; deliberate short floods are
    // blocked, normal requests use the existing rolling quota.
    if(state.burst>=MAX_BURST){
      state.blockedUntil=time+blockMs;
      return {allowed:false,blocked:true,retryAfterMs:blockMs};
    }
    state.burst++;
    state.times.push(time);
    return {allowed:true,blocked:false,retryAfterMs:0};
  };
}

export const checkMcpGatewayQos=createMcpGatewayQos();
