import {firstPartyOAuthClient} from './extension-client.mjs';

// A first-party public client returned by Better Auth clientDiscovery can be
// accepted for /authorize even if it has no persisted las_oauth_client row.
// Its Consent row, however, has a real FK to las_oauth_client.clientId.
// Register this one bundled client through the existing LAS_DATABASE_URL
// connection, only on an authenticated first-party consent request.
// Do not rename/delete legacy clients or any associated refresh tokens.
export function isFirstPartyOAuthConsent(body){
  const q=body?.oauth_query;
  if(typeof q!=='string'||q.length>8192)return false;
  const params=new URLSearchParams(q);
  return params.has('sig')&&
    params.get('client_id')===firstPartyOAuthClient().clientId;
}

const FIELDS='"clientId","redirectUris","grantTypes","responseTypes","scopes",'+
  '"tokenEndpointAuthMethod","requirePKCE","disabled","skipConsent"';

function assertCompatibleClient(row,expected){
  const sameSet=(a,b)=>Array.isArray(a)&&a.length===b.length&&
    [...a].sort().every((value,i)=>value===[...b].sort()[i]);
  if(row.clientId!==expected.clientId||
     !sameSet(row.redirectUris,expected.redirectUris)||
     !sameSet(row.grantTypes,expected.grantTypes)||
     !sameSet(row.responseTypes,expected.responseTypes)||
     !sameSet(row.scopes,expected.scopes)||
     row.tokenEndpointAuthMethod!=='none'||
     row.requirePKCE!==true||row.disabled===true||row.skipConsent===true)
    throw new Error('LAS first-party OAuth client exists with an incompatible registration');
}

// No new SQL gateway, database profile, migration, RLS changes or service
// secrets. Pool belongs to createLocAuth and is closed by the Worker request.
export async function ensureFirstPartyOAuthClient(pool){
  const expected=firstPartyOAuthClient();
  const conn=await pool.connect();
  try{
    const find=()=>conn.query(
      'SELECT '+FIELDS+' FROM public.las_oauth_client WHERE "clientId"=$1 LIMIT 1',
      [expected.clientId]);
    const existing=await find();
    if(existing.rows?.length){
      assertCompatibleClient(existing.rows[0],expected);
      return {created:false,clientId:expected.clientId};
    }
    // Race-safe, strictly scoped and idempotent; the metadata is bundled,
    // not supplied by the browser, and old client IDs are left untouched.
    const values=[
      crypto.randomUUID(),expected.clientId,expected.clientId,
      expected.name,expected.uri,expected.icon,
      JSON.stringify(expected.redirectUris),JSON.stringify(expected.grantTypes),
      JSON.stringify(expected.responseTypes),JSON.stringify(expected.scopes),
      expected.tokenEndpointAuthMethod,expected.applicationType,
      expected.requirePKCE,expected.disabled,expected.skipConsent,
      expected.enableEndSession,expected.subjectType
    ];
    const inserted=await conn.query(`
      INSERT INTO public.las_oauth_client
        ("id","clientId","clientDiscoveryId","name","uri","icon",
         "redirectUris","grantTypes","responseTypes","scopes",
         "tokenEndpointAuthMethod","applicationType",
         "requirePKCE","disabled","skipConsent","enableEndSession","subjectType",
         "createdAt","updatedAt")
      VALUES
        ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
         $11,$12,$13,$14,$15,$16,$17,now(),now())
      ON CONFLICT ("clientId") DO NOTHING
      RETURNING "clientId"
    `,values);
    if(!inserted.rowCount){
      const competing=await find();
      if(!competing.rows?.length)
        throw new Error('LAS first-party OAuth client registration was not persisted');
      assertCompatibleClient(competing.rows[0],expected);
    }
    return {created:inserted.rowCount>0,clientId:expected.clientId};
  }finally{
    conn.release();
  }
}
