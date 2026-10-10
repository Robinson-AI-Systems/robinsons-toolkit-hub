// TEMPORARY (K-0 red proof): proves a failing unit test turns `unit` and the aggregate `ci` red. Removed next push.
import { expect, it } from 'vitest';
it('fails on purpose to prove CI goes red', () => expect(1 + 1).toBe(3));
