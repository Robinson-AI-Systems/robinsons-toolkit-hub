import {it,expect,vi} from 'vitest';
import {registerDeveloperClient,developerHandoff,developerClientValid,ownerSetup} from '../src/developer-handoff.js';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'synthetic-owner',HUB_TOKEN_PEPPER:'synthetic-test-only-pepper-for-unit-tests'};
it('rejects invalid registration metadata and malformed handoffs before database access',async()=>{
 const db={query:vi.fn()};
 expect((await registerDeveloperClient(db,{redirect_uris:['https://attacker.example']},{env})).status).toBe(400);
 expect((await developerHandoff(db,{method:'POST',body:{profile:'full'}},{env})).status).toBe(400);
 expect(await developerClientValid(db,'bad','bad',{env})).toBe(false);expect(db.query).not.toHaveBeenCalled();
});
it('first-time setup denies missing, expired and already-configured activation before reads',async()=>{
 const db={query:vi.fn()};
 for(const changed of [env,{...env,HUB_OWNER_SETUP_HASH:'a'.repeat(64),HUB_OWNER_SETUP_EXPIRES:'2000-01-01'},{...env,HUB_OWNER_SCRYPT:'configured'}])expect((await ownerSetup(db,{method:'GET',query:{setup_token:'x'.repeat(43)}},{env:changed})).status).toBe(403);
 expect(db.query).not.toHaveBeenCalled();
});
it('valid dynamic registration returns confidential client data only to the caller and rolls back failure',async()=>{
 const db={query:vi.fn().mockResolvedValue({rows:[]})};
 const input={redirect_uris:[env.HUB_PUBLIC_ORIGIN+'/api/developer/connect'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'client_secret_post'};
 const r=await registerDeveloperClient(db,input,{env});expect(r.status).toBe(201);expect(r.json.client_secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
 expect(db.query.mock.calls.find(([sql])=>sql.includes('secret_digest'))[1][1]).not.toBe(r.json.client_secret);
 db.query.mockRejectedValueOnce(Error('private-db-detail'));await expect(registerDeveloperClient(db,input,{env})).rejects.toThrow();
});
