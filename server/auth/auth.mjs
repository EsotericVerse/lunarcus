import {betterAuth} from 'better-auth';
import {APIError,createAuthMiddleware,getAuthoritativeSessionFromCtx} from 'better-auth/api';
import {admin,jwt} from 'better-auth/plugins';
import {createAccessControl} from 'better-auth/plugins/access';
import {ZenStackClient} from '@zenstackhq/orm';
import {zenstackAdapter} from '@zenstackhq/better-auth';
import {oauthProvider} from '@better-auth/oauth-provider';
import {PostgresDialect} from 'kysely';
import {createAuthPostgresPool} from './pg-driver.mjs';
import * as z from 'zod';
import {RAINBOW_TABLES} from './rainbow-tables.mjs';
import {rainbowSchema,RAINBOW_MODEL_NAMES} from './rainbow-zmodel.mjs';
import {lasAuthRatePolicy} from './auth-rate.mjs';
import {extensionClientDiscovery} from './extension-client.mjs';
import {ensureFirstPartyOAuthClient,isFirstPartyOAuthConsent} from './first-party-client.mjs';

// LOC Auth is the issuer. Google is the sole sign-in path; Cloudflare Access
// SSO was removed 2026-11-17 — it only re-authenticated the same Google
// account one extra OAuth hop away, with its own secret pair, and was the
// leg that broke on the last domain change. LOC Auth does not own LOC Web
// content or business roles.
// Neon supplies PostgreSQL storage, NOT Neon Auth. Neither website rendering
// nor business permissions are implemented here.
export const LOC_ISSUER='https://auth.lo3rwang.cc';
export const LOC_WEB='https://loc.lo3rwang.cc';
export const LOC_MCP='https://mcp.lo3rwang.cc';
export const LOC_IMPORT=LOC_MCP+'/api/loc-native';
const OWNER_EMAIL='sopa2306@gmail.com';
// Native Better Auth resource/action permissions. The Auth administrator may
// ban/unban and revoke sessions, but cannot impersonate, delete accounts or
// grant itself new roles. LOC Web business rights remain in api.manage.
const authActions={user:['get','list','ban'],session:['list','revoke','delete']};
const authAc=createAccessControl(authActions);
const authRoles={
  admin:authAc.newRole(authActions),
  // Legacy tier for identities that came in through the now-removed
  // Cloudflare Access SSO path rather than Google. Kept only so an existing
  // stored user row with this role still resolves; no new account is ever
  // assigned it. Same empty permission set as a plain user.
  scope:authAc.newRole({user:[],session:[]}),
  user:authAc.newRole({user:[],session:[]})
};

// Auth owns only explicitly named LAS tables. This is model mapping,
// NOT SQL DDL. No table or RLS policy is created when this module loads.
export {RAINBOW_TABLES} from './rainbow-tables.mjs';


// Session data is a *short-lived signed cache*, not the Auth source of truth.
// Cloudflare gives each Worker version a stable ID. A new deployment changes
// that ID, invalidating old cookie-cache values without deleting SQL Sessions.
// This is intentionally independent of LOC Web and its api.manage rights.
export function locAuthSessionCache(env={}){
  const workerVersion=String(env?.CF_VERSION_METADATA?.id||'').trim();
  return {
    enabled:true,
    maxAge:30*60,
    strategy:'compact',
    version:workerVersion||'loc-auth-local'
  };
}

// Validate the Worker boundary once. Do not expose connection strings or
// OAuth secrets in Zod errors, logs, or HTTP responses.
const AuthEnvironmentSchema=z.object({
  connectionString:z.url().refine(value=>
    ['postgresql:','postgres:'].includes(new URL(value).protocol)),
  secret:z.string().min(32),
  namespace:z.literal('public')
});

// Google is the sole sign-in path. It is still validated, not hardcoded,
// because the owner account is bound to it and losing these two variables
// must fail loudly rather than silently disable login.
export function googleSocialConfig(env={}){
  const clientId=String(env?.LOC_GOOGLE_CLIENT_ID||env?.GOOGLE_CLIENT_ID||'').trim();
  const clientSecret=String(env?.LOC_GOOGLE_CLIENT_SECRET||env?.GOOGLE_CLIENT_SECRET||'').trim();
  return clientId&&clientSecret?{clientId,clientSecret}:null;
}

// Hyperdrive is required for every Better Auth SQL operation. A legacy
// LAS_DATABASE_URL Secret may remain bound during rollout, but cannot bypass
// this check or silently restore direct Neon connections.
export function lasAuthConnectionString(env={}){
  const value=env?.LAS_HYPERDRIVE?.connectionString;
  if(typeof value!=='string'||!value.trim())
    throw new Error('LAS_HYPERDRIVE binding is required for Auth PostgreSQL');
  return value;
}

export function checkLocAuthEnvironment(env){
  const data={
    connectionString:lasAuthConnectionString(env),
    secret:env?.LOC_CONTROL_ENCRYPTION_KEY,
    namespace:'public'
  };
  if(data.namespace!=='public')
    throw new Error('LAS tables must use the public PostgreSQL schema');
  const verified=AuthEnvironmentSchema.safeParse(data);
  if(!verified.success)
    throw new Error('LAS requires PostgreSQL and a control secret (>= 32 characters)');
  if(!googleSocialConfig(env))
    throw new Error('LOC Auth requires Google OAuth credentials (the sole sign-in path)');
  return true;
}

export function createLocAuth(env){
  checkLocAuthEnvironment(env);
  // Built-in Kysely PostgreSQL adapter using request-scoped pg.Client
  // connections to Cloudflare Hyperdrive. Hyperdrive owns the origin TLS
  // connection pool, not the Worker or an old database URL Secret.
  // No hand-written Auth storage, SQL, session, PKCE or OAuth state handling.
  const pool=createAuthPostgresPool(lasAuthConnectionString(env));
  // Official ZenStack v3 Better Auth adapter delegates all Auth storage CRUD
  // to ZenStack ORM over the existing Kysely PostgresDialect. No parallel SQL
  // adapter or runtime schema discovery is introduced.
  const db=new ZenStackClient(rainbowSchema,{dialect:new PostgresDialect({pool})});
  // The OAuth provider delegates client/resource authorization to the
  // application; it does not automatically apply the Admin Plugin's roles.
  // Use Better Auth's authoritative on-demand Session check for privileged
  // management operations only. Ordinary SSO retains the signed cookie cache.
  const activeAuthAdmin=async (headers)=>{
    try{
      const live=await auth.api.getSession({
        headers,query:{disableCookieCache:true,disableRefresh:true}
      });
      return live?.user?.role==='admin'&&live.user.banned!==true
        &&live.user.emailVerified===true?live.user:null;
    }catch{return null;}
  };
  const ownerPrivilege=async ({headers})=>{
    const user=await activeAuthAdmin(headers);
    return Boolean(user&&String(user.email||'').trim().toLowerCase()===OWNER_EMAIL);
  };
  const auth=betterAuth({
    appName:'LOC Auth',
    baseURL:LOC_ISSUER,
    basePath:'/api/auth',
    secret:env.LOC_CONTROL_ENCRYPTION_KEY,
    // Trust only the bundled first-party Chrome Extension for OAuth code exchange.
    // The Worker CORS allowlist already contains this exact origin; Better Auth
    // independently checks POST /oauth2/token against trustedOrigins.
    trustedOrigins:[
      LOC_ISSUER,
      LOC_WEB,
      'chrome-extension://hiaeafonocnjaclcfgjmdopbcgnafnna'
    ],
    // Official Better Auth middleware: high-risk Admin API requests bypass the
    // 30-minute cookie cache once, preventing revoked Sessions from managing
    // Auth accounts. No background polling or extra Session store.
    hooks:{before:createAuthMiddleware(async ctx=>{
      // Better Auth's top-level before hook is one native middleware, not an
      // array of {matcher,handler} entries. Branch here so the published
      // Better Auth 1.7.x runner receives the callable middleware it expects.
      if(['/oauth2/authorize','/oauth2/consent','/oauth2/continue'].includes(ctx.path)){
        // Better Auth's native authoritative reader bypasses a signed Cookie
        // Cache for OAuth issuance. Initial unauthenticated authorization still
        // reaches the provider's standard login redirect, without DB polling.
        const token=await ctx.getSignedCookie(
          ctx.context.authCookies.sessionToken.name,ctx.context.secret
        );
        if(!token)return;
        const active=await getAuthoritativeSessionFromCtx(ctx);
        if(!active?.session)
          throw new APIError('UNAUTHORIZED',{
            message:'OAuth Session expired or revoked'
          });
        // OAuth clientDiscovery serves the bundled first-party client before
        // it exists in SQL. The persistent Consent row has a real FK to the
        // OAuth Client table; register only this fixed public client, using
        // the existing request-scoped Hyperdrive connection.
        if(ctx.path==='/oauth2/consent'&&isFirstPartyOAuthConsent(ctx.body))
          await ensureFirstPartyOAuthClient(pool);
        return;
      }
      // has-permission is an introspection endpoint for ordinary users, not
      // an account-management action; leave its native authorization intact.
      if(ctx.path?.startsWith('/admin/')===true&&ctx.path!=='/admin/has-permission'&&
         !await activeAuthAdmin(ctx.headers))
        throw new APIError('FORBIDDEN',{message:'Active administrator session required'});
    })},
    // Better Auth validates its own plugin inputs; ZenStack validates ORM
    // writes using the same shared schema, without duplicate custom hooks.
    // Existing Rainbow array-valued fields are JSONB, not PostgreSQL
    // native array columns. Let the published adapter serialize them.
    database:zenstackAdapter(db,{provider:'postgresql',supportsArrays:false}),
    user:{modelName:RAINBOW_MODEL_NAMES.user},
    session:{modelName:RAINBOW_MODEL_NAMES.session,
      expiresIn:30*86400,updateAge:86400,storeSessionInDatabase:true,
      cookieCache:locAuthSessionCache(env)},
    // One LOC identity per verified email address. Linking must be enabled or
    // Better Auth refuses outright (oauth2/link-account.mjs: a false
    // `accountLinking.enabled` alone rejects the link), which would strand the
    // existing owner account on its original provider and leave nobody able to
    // administer Auth. Different email addresses are still never merged.
    account:{modelName:RAINBOW_MODEL_NAMES.account,
      accountLinking:{enabled:true,allowDifferentEmails:false,
        trustedProviders:['google']}},
    verification:{modelName:RAINBOW_MODEL_NAMES.verification},
    emailAndPassword:{enabled:false},
    // Google is the sole sign-in provider.
    // disableSignUp makes Google a whitelist, not an open door. Better Auth
    // only consults this flag when no user with the incoming email exists
    // (oauth2/link-account.mjs: the check sits in the no-existing-user branch,
    // after the link branch has already returned). So an address the owner
    // pre-created through the admin menu still links on first Google login,
    // while an unknown Gmail is refused instead of silently getting an
    // account. Admin create-user goes through the admin endpoint, not this
    // path, so the owner can still add people.
    ...(googleSocialConfig(env)?{socialProviders:{google:{
      ...googleSocialConfig(env),disableIdTokenSignIn:true,disableSignUp:true
    }}}:{}),
    disabledPaths:['/token'],
    // Karaul owns all LOC Auth QoS policy; Better Auth enforces its decision.
    rateLimit:lasAuthRatePolicy,
    advanced:{
      useSecureCookies:true,
      // The LOC website receives the opaque session cookie only for explicit
      // protected operations. Public rendering never consults Auth.
      crossSubDomainCookies:{enabled:true,domain:'lo3rwang.cc'},
      // Schema is verified out of band; skip the per-request introspection
      // query, which otherwise runs on every fresh serverless connection.
      database:{joins:false,validateSchema:false},
      ipAddress:{ipAddressHeaders:['cf-connecting-ip']}
    },
    plugins:[
      admin({ac:authAc,roles:authRoles,defaultRole:'user',adminRoles:['admin']}),
      jwt({
        schema:{jwks:{modelName:RAINBOW_MODEL_NAMES.jwks}},
        disableSettingJwtHeader:true,
        jwks:{
          keyPairConfig:{alg:'RS256',modulusLength:3072},
          rotationInterval:30*86400,
          gracePeriod:30*86400
        },
        jwt:{issuer:LOC_ISSUER+'/api/auth'}
      }),
      oauthProvider({
        // OAuth endpoint budgets are included in the unified Karaul policy.
        schema:{
          oauthClient:{modelName:RAINBOW_MODEL_NAMES.oauthClient},
          oauthResource:{modelName:RAINBOW_MODEL_NAMES.oauthResource},
          oauthClientResource:{modelName:RAINBOW_MODEL_NAMES.oauthClientResource},
          oauthRefreshToken:{modelName:RAINBOW_MODEL_NAMES.oauthRefreshToken},
          oauthAccessToken:{modelName:RAINBOW_MODEL_NAMES.oauthAccessToken},
          oauthConsent:{modelName:RAINBOW_MODEL_NAMES.oauthConsent},
          oauthClientAssertion:{modelName:RAINBOW_MODEL_NAMES.oauthClientAssertion}
        },
        loginPage:'/login',
        consentPage:'/consent',
        scopes:['openid','profile','email','offline_access','loc:import'],
        resources:[LOC_WEB,LOC_MCP,LOC_IMPORT],
        grantTypes:['authorization_code','refresh_token'],
        // PKCE/authorization codes/refresh rotation/OIDC are native modules.
        allowDynamicClientRegistration:true,
        // LunArcus Chrome is a fixed first-party public client resolved from the
        // bundled client.json below; arbitrary anonymous DCR remains disabled.
        // Other client registrations must authenticate and pass privileges.
        allowUnauthenticatedClientRegistration:false,
        enforcePerClientResources:false,
        clientRegistrationDefaultScopes:['openid','profile','email'],
        clientRegistrationAllowedScopes:['offline_access','loc:import'],
        clientRegistrationAllowedResources:[LOC_IMPORT],
        clientRegistrationDefaultResources:[LOC_MCP],
        clientPrivileges:ownerPrivilege,
        resourcePrivileges:ownerPrivilege,
        extensions:[{clientDiscovery:extensionClientDiscovery()}]
      })
    ]
  });
  return {auth,pool};
}
