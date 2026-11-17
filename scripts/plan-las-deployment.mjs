/**
 * LAS deployment impact is two-dimensional: which LAS runtime changed,
 * and whether the published LOC client needs a rebuild.
 *
 * Never infer LOC deployment from a generic LAS commit, a shared package
 * version, Chrome Plugin, or a LAS-owned CMS mapping.
 */
const AUTH_RUNTIME=/^(?:app\/las\/auth\/|vendor\/loc-dialect\/)/;
const AUTH_CONFIG=/^wrangler\.jsonc$/;
const MCP_RUNTIME=/^app\/las\/(?:mcp|tunnel)\//;
const PLUGINS=/^(?:plugins\/|public\/plugins\/)/;
const AUTH_PUBLIC=/^(?:app\/las\/index\.mjs|app\/las\/auth\/(?:auth|extension-client)\.mjs)$/;
const MCP_PUBLIC=/^app\/las\/mcp\/(?:server|router|tool-contracts|business-actions)\.mjs$/;
const AUTH_CONTRACT=/(?:\/api\/auth\/|\/\.well-known\/|LOC_ISSUER|LOC_WEB|oauth2|openid|oidc|issuer|redirect_uri|callbackURL|allowedOrigins?|session|cookie|scope|authorization|tokenEndpoint|client_id)/i;
const MCP_LOC_CONTRACT=/(?:\/api\/las-native|\/api\/loc-native|LOC_PROXY_ROUTES|locProxy|mcp-(?:authorize|read|search|public-read|article-stat)|api\.manage)/i;

function changedCode(patch) {
  if(typeof patch!=='string')return null;
  return patch.split(/\r?\n/).filter(line=>/^[+-](?![+-])/.test(line))
    .map(line=>line.slice(1).trim())
    .filter(line=>line.length>0&&!line.startsWith('//')&&!line.startsWith('*')&&!line.startsWith('#'));
}
function pathOf(file) {
  return typeof file==='string'?file:file?.filename;
}
export function planLasDeployment(changes) {
  if(!Array.isArray(changes)||changes.length===0)
    return Object.freeze({las:{auth:false,mcp:false,plugins:false},loc:'review',reasons:['no verified change list']});
  const las={auth:false,mcp:false,plugins:false};
  const reasons=[];
  let notify=false,review=false;
  for(const file of changes){
    const path=pathOf(file);
    if(typeof path!=='string'||!path||path.includes('..')||path.startsWith('/')) {
      review=true;reasons.push('invalid change path');continue;
    }
    const patch=typeof file==='string'?undefined:file?.patch;
    if(PLUGINS.test(path)){las.plugins=true;continue;}
    if(AUTH_RUNTIME.test(path)||AUTH_CONFIG.test(path)||path==='app/las/index.mjs')las.auth=true;
    // LAS-owned CMS Data Mapping is a data contract, not a deployed server.
    // Do not schedule either MCP or LOC solely because its model changed.
    if(path.startsWith('app/las/tunnel/'))continue;
    if(MCP_RUNTIME.test(path))las.mcp=true;
    if(AUTH_PUBLIC.test(path)){
      const lines=changedCode(patch);
      if(lines===null){review=true;reasons.push('Auth public contract needs diff review: '+path);}
      else if(lines.some(line=>AUTH_CONTRACT.test(line))){
        notify=true;reasons.push('Auth public contract changed: '+path);
      }
      continue;
    }
    if(MCP_PUBLIC.test(path)){
      const lines=changedCode(patch);
      if(lines===null){review=true;reasons.push('MCP server contract needs diff review: '+path);}
      else if(lines.some(line=>MCP_LOC_CONTRACT.test(line))){
        // MCP production is already on the LAS Worker; LOC-facing changes
        // still require explicit review before a LOC deployment.
        review=true;reasons.push('MCP-to-LOC protocol edge changed: '+path);
      }
      continue;
    }
    if(AUTH_CONFIG.test(path)){
      const lines=changedCode(patch);
      if(lines===null||lines.some(line=>/routes|custom_domain|auth\.lo3rwang\.cc/.test(line))){
        review=true;reasons.push('Auth deployment route/config changed: '+path);
      }
      continue;
    }
    // Installing or changing libraries can affect server bundles but is not
    // evidence that the LOC-facing interface changed.
    if(/^(?:package\.json|package-lock\.json)$/.test(path))continue;
  }
  if(reasons.length===0)reasons.push('No LOC-facing published contract change detected');
  return Object.freeze({
    las:Object.freeze(las),
    loc:notify?'notify':review?'review':'skip',
    reasons:Object.freeze(reasons)
  });
}

/** Manual dispatch is explicit, automatic mode preserves the classifier. */
export function chooseLocAction(plan,mode='auto'){
  if(!['auto','notify','skip'].includes(mode))throw Error('Unsupported LOC deployment mode');
  return mode==='auto'?plan.loc:mode;
}
