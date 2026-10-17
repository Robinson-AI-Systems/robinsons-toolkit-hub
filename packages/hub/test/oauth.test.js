import { it, expect, vi } from 'vitest';
import { registerOAuthClient, issueOAuthCode, exchangeOAuthCode,
  rotateOAuthRefresh, authenticateOAuth, revokeOAuthFamily } from '../src/oauth.js';
const pepper='synthetic-oauth-unit-test-pepper-never-deployed';
it('requires a verified owner before registering/issuing/revoking', async () => {
  const db={query:vi.fn()};
  await expect(registerOAuthClient(db,{ownerId:'owner',clientId:'approvedclient',redirectUri:'https://agent.example/cb'}))
    .rejects.toThrow();
  await expect(issueOAuthCode(db,{profile:'read_only',mode:'test',areas:[]},{pepper})).rejects.toThrow();
  await expect(revokeOAuthFamily(db,{ownerId:'owner',sessionId:'fake'})).rejects.toThrow();
  expect(db.query).not.toHaveBeenCalled();
});
it('refuses dangerous redirects, scope and malformed PKCE before database work', async () => {
  const db={query:vi.fn()};
  for(const redirectUri of ['http://app.example/cb','https://evil.example/cb?secret=1','http://localhost/cb']) {
    await expect(registerOAuthClient(db,{ownerId:'owner',clientId:'approvedclient',redirectUri},{ownerVerified:true}))
      .rejects.toThrow();
  }
  await expect(issueOAuthCode(db,{profile:'read_only',mode:'live',allowWrites:true,
    areas:['gateway'],challenge:'x'.repeat(43)},
    {pepper,ownerVerified:true})).rejects.toThrow();
  expect(db.query).not.toHaveBeenCalled();
});
it('exchange and refresh do not create credentials from invalid inputs', async () => {
  const db={query:vi.fn()};
  expect(await exchangeOAuthCode(db,{code:'bad',verifier:'invalid'},{pepper})).toBeNull();
  expect(await rotateOAuthRefresh(db,{refreshToken:'invalid'},{pepper})).toBeNull();
  expect(await authenticateOAuth(db,'bad',{pepper})).toBeNull();
  expect(db.query).not.toHaveBeenCalled();
});
