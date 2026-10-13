import pg from 'pg';
import { authenticateOAuth } from './oauth.js';
import { authenticateHubPass } from './identity.js';
import { takeBudget } from './limits.js';
let pool, currentUrl;
export function hubSettings(env=process.env) {
  if (typeof env.HUB_DATABASE_URL!=='string' || !env.HUB_DATABASE_URL ||
    typeof env.HUB_TOKEN_PEPPER!=='string' || env.HUB_TOKEN_PEPPER.length<32)
    throw new Error('Hub storage/authentication not configured');
  return {url:env.HUB_DATABASE_URL,pepper:env.HUB_TOKEN_PEPPER};
}
export async function withHubDb(fn,env=process.env) {
  const settings=hubSettings(env);
  if (!pool || currentUrl!==settings.url) {
    if (pool) await pool.end();
    pool=new pg.Pool({connectionString:settings.url,max:2,
      connectionTimeoutMillis:3000,idleTimeoutMillis:3000,statement_timeout:5000});
    currentUrl=settings.url;
  }
  const client=await pool.connect();
  try { return await fn(client,settings); } finally { client.release(); }
}
export async function hubActor(db,settings,authorization,kind) {
  if (typeof authorization!=='string' || !authorization.startsWith('Bearer ')) return null;
  const actor=kind==='mcp' ? await authenticateOAuth(db,authorization.slice(7),settings) :
    await authenticateHubPass(db,authorization,settings);
  if (!actor) return null;
  const budget=await takeBudget(db,{scope:'hub:'+kind+':'+actor.id,
    pepper:settings.pepper,max:120});
  return budget.allowed ? {actor} : {retryAfter:budget.retryAfter};
}
