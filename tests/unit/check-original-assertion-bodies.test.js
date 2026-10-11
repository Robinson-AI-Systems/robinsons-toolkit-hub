import { describe, expect, it } from 'vitest';
import { assertionBodies, gitBlobSha, verifyOriginalAssertionBodies } from '../../scripts/check-original-assertion-bodies.mjs';

describe('pinned upstream assertion-body parity',()=>{
  it('executes every selected original upstream assertion body unchanged',()=>{
    expect(verifyOriginalAssertionBodies()).toBe(15);
  });
  it('rejects body changes even if test title and expect count are preserved',()=>{
    const first="it('sample',()=>{ expect(true).toBe(true); });";
    const second="it('sample',()=>{ expect(false).toBe(true); });";
    expect(assertionBodies(first).get('sample')).not.toBe(assertionBodies(second).get('sample'));
  });
  it('uses Git blob rather than raw file hashes for the source snapshots',()=>{
    expect(gitBlobSha('test')).toBe('30d74d258442c7c65512eafab474568dd706c430');
  });
});
