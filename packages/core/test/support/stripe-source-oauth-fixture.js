// Offline minimal contract for the original Stripe OAuth unit-suite assertions.
// Not a copy of Stripe service SQL: does not establish cross-instance atomicity.
import {randomUUID} from 'node:crypto';
import {hashToken} from '../../../../docs/audits/upstream/runtime/oauth.js';

export function createFakeDb({clock=Date.now,accounts=[]}={}){
  const clients=new Map(),codes=new Map(),tokens=new Map(),attempts=[];
  const copy=value=>value==null?null:structuredClone(value);
  return Object.freeze({
    async createOAuthClient({clientId,clientSecret,redirectUris,clientName}){
      if(clients.has(clientId))throw Error('duplicate client');
      clients.set(clientId,{client_id:clientId,client_secret_hash:hashToken(clientSecret),
        redirect_uris:copy(redirectUris),client_name:clientName});
    },
    async getOAuthClient(id){return copy(clients.get(id)||null);},
    async createAuthCode({code,clientId,redirectUri,codeChallenge,codeChallengeMethod='S256',
      stripeAccount=null,mode='test',profile='everyday',listing='catalog',ttlSeconds=600}){
      codes.set(hashToken(code),{client_id:clientId,redirect_uri:redirectUri,
        code_challenge:codeChallenge,code_challenge_method:codeChallengeMethod,
        stripe_account:stripeAccount,mode,profile,listing,expiresAt:clock()+ttlSeconds*1000});
    },
    async consumeAuthCode(code){
      const key=hashToken(code),row=codes.get(key);codes.delete(key);
      if(!row||row.expiresAt<=clock())return null;
      const {expiresAt:_,...result}=row;return copy(result);
    },
    async createAccessToken({accessToken,refreshToken,clientId,stripeAccount=null,mode='test',
      profile='everyday',listing='catalog',ttlSeconds=3600}){
      tokens.set(hashToken(accessToken),{token_hash:hashToken(accessToken),
        refresh_hash:hashToken(refreshToken),client_id:clientId,stripe_account:stripeAccount,
        mode,profile,listing,result_scope:randomUUID(),expiresAt:clock()+ttlSeconds*1000,revoked:false});
    },
    async getAccessToken(token){
      const row=tokens.get(hashToken(token));
      if(!row||row.revoked||row.expiresAt<=clock())return null;
      return copy({client_id:row.client_id,stripe_account:row.stripe_account,mode:row.mode,
        profile:row.profile,listing:row.listing,result_scope:row.result_scope});
    },
    async rotateRefreshToken({refreshToken,clientId,accessToken,newRefreshToken,ttlSeconds=3600}){
      const row=[...tokens.values()].find(x=>x.refresh_hash===hashToken(refreshToken)&&
        x.client_id===clientId&&!x.revoked);
      if(!row)return null;
      tokens.delete(row.token_hash);row.token_hash=hashToken(accessToken);
      row.refresh_hash=hashToken(newRefreshToken);row.expiresAt=clock()+ttlSeconds*1000;
      tokens.set(row.token_hash,row);
      return copy({client_id:row.client_id,stripe_account:row.stripe_account,mode:row.mode,
        profile:row.profile,listing:row.listing});
    },
    async listStripeAccounts(){return copy(accounts);},
    async recordLoginAttempt(ip){
      const id=attempts.length+1;attempts.push({id,ip,at:clock(),success:false});return id;
    },
    async markLoginAttemptSucceeded(id){
      const item=attempts.find(x=>x.id===id);if(item)item.success=true;
    },
    async countRecentFailedLogins(ip,minutes){
      return attempts.filter(x=>x.ip===ip&&!x.success&&x.at>clock()-minutes*60000).length;
    }
  });
}
