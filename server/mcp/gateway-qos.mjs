// LAS MCP admission QoS uses the existing Karaul package but owns its own
// per-isolate request budget. No LOC Search implementation or DB is imported.
import {detectChangepoints,PoissonCost} from 'karaul';
const BUCKET_MS=5000,BUCKETS=16,MIN_SURGE=36;
export const MCP_QOS_BUDGET=Object.freeze({
  max:120,windowMs:60000,blockMs:30000,maxEntries:1024
});
export function createMcpGatewayQos({now=()=>Date.now(),max=120,windowMs=60000,
  blockMs=30000,maxEntries=1024,detect=series=>detectChangepoints(series,new PoissonCost())}={}){
  const entries=new Map();
  return function check(key){
    const identity=String(key||'anonymous-unknown').slice(0,256);
    const time=now(),tick=Math.floor(time/BUCKET_MS);
    let state=entries.get(identity);
    if(!state||tick<state.tick||tick-state.tick>=BUCKETS)
      state={tick,counts:Array(BUCKETS).fill(0),times:[],blockedUntil:0};
    entries.delete(identity);
    entries.set(identity,state);
    if(entries.size>maxEntries)entries.delete(entries.keys().next().value);

    if(state.blockedUntil>time)
      return {allowed:false,blocked:true,retryAfterMs:state.blockedUntil-time};
    if(state.blockedUntil){
      state.times=[];
      state.counts.fill(0);
      state.tick=tick;
      state.blockedUntil=0;
    }
    if(tick>state.tick){
      const shift=tick-state.tick;
      state.counts.copyWithin(0,shift);
      state.counts.fill(0,BUCKETS-shift);
      state.tick=tick;
      const completed=state.counts.slice(0,-1);
      if(completed.reduce((a,b)=>a+b,0)>=MIN_SURGE){
        try{
          const point=detect(completed).at(-1);
          if(point>=4&&point<completed.length){
            const previous=completed.slice(0,point);
            const recent=completed.slice(point);
            const before=previous.reduce((a,b)=>a+b,0)/previous.length;
            const after=recent.reduce((a,b)=>a+b,0)/recent.length;
            if(after*recent.length>=MIN_SURGE&&after>=Math.max(12,before*4)){
              state.blockedUntil=time+blockMs;
              return {allowed:false,blocked:true,retryAfterMs:blockMs};
            }
          }
        }catch{
          // Analysis is advisory; existing request budget still applies.
        }
      }
    }
    state.counts[BUCKETS-1]++;
    state.times=state.times.filter(t=>time-t<windowMs);
    if(state.times.length>=max){
      const retryAfterMs=Math.max(1000,windowMs-(time-state.times[0]));
      return {allowed:false,blocked:false,retryAfterMs};
    }
    state.times.push(time);
    return {allowed:true,blocked:false,retryAfterMs:0};
  };
}

export const checkMcpGatewayQos=createMcpGatewayQos();
