// The LAS Better Auth SQL model mappings are a single immutable source
// for Better Auth and its ZenStack/Zod validation-only model contract.
export const LAS_AUTH_TABLES=Object.freeze({
  user:'las_auth',
  session:'las_session',
  account:'las_account',
  verification:'las_verification',
  jwks:'las_jwks',
  oauthClient:'las_oauth_client',
  oauthResource:'las_oauth_resource',
  oauthClientResource:'las_oauth_client_resource',
  oauthRefreshToken:'las_oauth_refresh_token',
  oauthAccessToken:'las_oauth_access_token',
  oauthConsent:'las_oauth_consent',
  oauthClientAssertion:'las_oauth_client_assertion'
});
