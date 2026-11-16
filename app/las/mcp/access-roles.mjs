// LAS delegates ONLY the existing LOC api.manage role decision to LOC.
// OAuth bearer validation (issuer/audience, UserInfo subject) and Scope rights
// are re-checked by LOC before returning any business result.
import {assertLocMcpRole} from './loc-mapping.mjs';

export async function authorizeMcpBearer(token,subject,env={},{
  fetchImpl=env?.lasFetch||globalThis.fetch
}={}){
  return assertLocMcpRole(token,subject,fetchImpl);
}
