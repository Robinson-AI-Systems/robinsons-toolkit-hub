import {describe,it,expect,vi} from 'vitest';
import {githubEvidenceJson} from '../../scripts/github-evidence-json.mjs';
import {focusPlan,focusGroups} from '../../scripts/dev-focus.mjs';
const policies={
  unavailable:'provider unavailable',
  failed:status=>'provider failed '+status,
  malformed:'provider invalid JSON'
};
describe('read-only GitHub evidence transport',()=>{
  it('uses only Accept headers and passes the abort signal through',async()=>{
    const signal=new AbortController().signal;
    const fetchImpl=vi.fn(async()=>({ok:true,json:async()=>({pinned:true})}));
    expect(await githubEvidenceJson(fetchImpl,'https://api.github.com/verified',{...policies,signal}))
      .toEqual({pinned:true});
    expect(fetchImpl).toHaveBeenCalledWith('https://api.github.com/verified',{
      headers:{Accept:'application/vnd.github+json'},signal
    });
  });
  it('fails closed on missing transport, rejected fetch, bad response and malformed JSON',async()=>{
    await expect(githubEvidenceJson(null,'irrelevant',policies)).rejects.toThrow(/provider unavailable/);
    await expect(githubEvidenceJson(async()=>{throw Error('credential');},'irrelevant',policies))
      .rejects.toThrow(/^Error: provider unavailable$/);
    await expect(githubEvidenceJson(async()=>({ok:false,status:403}),'irrelevant',policies))
      .rejects.toThrow(/provider failed 403/);
    await expect(githubEvidenceJson(async()=>({ok:true,json:async()=>{throw Error('leak');}}),
      'irrelevant',policies)).rejects.toThrow(/provider invalid JSON/);
  });
});
describe('repeatable focused development test recipes',()=>{
  it('maps exact approved fixtures without shell fragments or duplicate selectors',()=>{
    expect(focusPlan(['upstream'])).toEqual([...focusGroups.upstream]);
    expect(focusPlan(['core','core'])).toEqual([...focusGroups.core]);
    expect(focusPlan(['auth','release']).length).toBe(5);
  });
  it('refuses missing and arbitrary groups before launching any command',()=>{
    expect(()=>focusPlan([])).toThrow(/choose/);
    expect(()=>focusPlan(['../../shell'])).toThrow(/unknown/);
  });
});
