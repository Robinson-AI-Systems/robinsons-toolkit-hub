import { describe, expect, it } from 'vitest';
import { createLocalFiles } from '../src/local-files.js';

describe('local file grants', () => {
  it('refuses empty grant lists', async () => {
    await expect(createLocalFiles([])).rejects.toThrow();
  });
});
