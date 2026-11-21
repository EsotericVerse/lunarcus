// LAS Auth rate policy delegates enforcement to Better Auth's native
// per-endpoint counters and HTTP 429; no duplicate heuristic or memory map.
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

export function createLASAuthRateRules(){
  function budget(request,native){
    const path=new URL(request.url).pathname.replace(/^\/api\/auth(?=\/)/,'');
    const max=ENDPOINTS[path];
    return max===undefined?native:{window:BASE.window,max};
  }
  // Better Auth's '*' matches one segment; '**' matches OAuth subpaths.
  // JWKS remains public, while all other native Auth guards stay enabled.
  return {'/jwks':false,'/**':budget};
}

export const lasAuthRatePolicy=Object.freeze({
  enabled:true,...BASE,customRules:createLASAuthRateRules()
});
