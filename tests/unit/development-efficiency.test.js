import {readFileSync} from 'node:fs';
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
      .rejects.toThrow(/^provider unavailable$/);
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

describe('outcome-first owner workflow remains authoritative',()=>{
  it('requires a milestone, blocker re-entry and independent acceptance',()=>{
    const agents=readFileSync(new URL('../../AGENTS.md',import.meta.url),'utf8');
    const start=readFileSync(new URL('../../docs/SESSION-START.md',import.meta.url),'utf8');
    expect(agents).toContain('[SESSION-START](docs/SESSION-START.md)');
    const policy=agents+'\n'+start;
    for(const word of ['observable result and finite acceptance','re-entry trigger',
      'deployed exact','authenticated end-to-end','permanent handoff'])
      expect(policy).toContain(word);
    expect(start).toContain('## 1a. Choose a substantial outcome');
    expect(start).toContain('five substantial merged PRs');
    expect(start).toContain('next higher PR-number multiple of five');
    expect(start).toContain('An explicit pre-merge gate still blocks that PR');
    expect(start).toContain('Never mark code/CI as deployed or real-provider proof');
  });
});
