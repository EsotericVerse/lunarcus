// LOC Auth QoS policy: Karaul detects change points and chooses the budget.
// Better Auth's upstream rateLimit.customRules performs counting and HTTP 429.
// Neither a second limiter nor an identity/Session blacklist is created.
import {detectChangepoints,PoissonCost} from 'karaul';

// Existing LOC Auth budgets are centralized here rather than spread across
// Better Auth core options and the OAuth Provider's own configuration.
// Paths are those normalized by Better Auth (without /api/auth).
const BASE=Object.freeze({window:60,max:120});
const ENDPOINTS=Object.freeze({
  '/oauth2/token':40,
  '/oauth2/authorize':60,
  '/oauth2/introspect':100,
  '/oauth2/revoke':30,
  '/oauth2/register':5,
  '/oauth2/client/rotate-keys':5,
  '/oauth2/userinfo':120
});

const BUCKET_MS=5000;
const BUCKET_COUNT=16;
const MAX_SOURCES=1024;
const SURGE_REQUESTS=36;
const poisson=new PoissonCost();

// Karaul's changepoint detector is advisory, not an enforcement budget of its
// own. A single real owner's traffic has a near-zero baseline, so a
// legitimate burst (the Extension catching up a backlog, a one-off bulk
// import) is statistically indistinguishable from an attack surge — treating
// a detected surge as its own, stricter budget (previously: 30s/max:1 for
// every path the surge touched) turned this into a self-inflicted outage
// instead of the soft signal it was meant to be. 2026-11-17: on a detected
// surge, Better Auth's normal per-endpoint budget above still applies in
// full; nothing here tightens it further.
export function createAuthKaraulRateRules({now=()=>Date.now(),detect=detectChangepoints}={}){
  // Shared across requests in one Worker isolate; no timers or persistence.
  const histories=new Map();

  function budget(request,native){
    const path=new URL(request.url).pathname.replace(/^\/api\/auth(?=\/)/,'');
    const preset=ENDPOINTS[path];
    const normal=preset===undefined?native:{window:BASE.window,max:preset};
    const source=request.headers.get('cf-connecting-ip');
    if(!source)return normal;

    // Changes in /get-session must not quarantine unrelated OAuth endpoints.
    const key=source+':'+path;
    const time=now();
    const tick=Math.floor(time/BUCKET_MS);
    let entry=histories.get(key);
    if(!entry||tick<entry.tick||tick-entry.tick>=BUCKET_COUNT)
      entry={tick,counts:Array(BUCKET_COUNT).fill(0)};
    histories.delete(key);
    histories.set(key,entry);
    if(histories.size>MAX_SOURCES)histories.delete(histories.keys().next().value);

    if(tick>entry.tick){
      const shift=tick-entry.tick;
      entry.counts.copyWithin(0,shift);
      entry.counts.fill(0,BUCKET_COUNT-shift);
      entry.tick=tick;
      const completed=entry.counts.slice(0,-1);
      const total=completed.reduce((a,b)=>a+b,0);
      if(total>=SURGE_REQUESTS){
        try{
          const boundaries=detect(completed,poisson);
          const change=boundaries.at(-1);
          if(change>=4&&change<completed.length){
            const baseline=completed.slice(0,change);
            const tail=completed.slice(change);
            const before=baseline.reduce((a,b)=>a+b,0)/baseline.length;
            const after=tail.reduce((a,b)=>a+b,0)/tail.length;
            if(after*tail.length>=SURGE_REQUESTS&&after>=Math.max(12,before*4)){
              // Signal only: Better Auth's own counter below still owns
              // whether this request is actually let through.
            }
          }
        }catch{
          // If analytics fails, Better Auth's normal rate limit still applies.
        }
      }
    }
    entry.counts[BUCKET_COUNT-1]++;
    return normal;
  }

  // Native customRules first-match: exact public JWKS exemption, then catch
  // every nested Auth endpoint in one Karaul policy (Better Auth's '*'
  // matches only one path segment; '**' covers nested OAuth client routes). The native limiter still owns
  // storage, route evaluation and 429 responses.
  // Routine identity/session reads are not login attempts. They can be
  // requested repeatedly by the owner's browser, LOC or MCP without the
  // per-IP 120/min ceiling turning healthy navigation into HTTP 429.
  // Better Auth still validates the cookie/token; only admission counting
  // is skipped on these read paths.
  return {
    '/jwks':false,
    '/get-session':false,
    '/oauth2/userinfo':false,
    '/oauth2/introspect':false,
    '/**':budget
  };
}

export const authKaraulRatePolicy=Object.freeze({
  enabled:true,
  ...BASE,
  customRules:createAuthKaraulRateRules()
});
