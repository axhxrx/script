import { expect } from '@std/expect';

import { describe, test } from '../_testkit.ts';
import { getGhAuthUsername } from './getAuthUsername.ts';

describe('gh utilities', () =>
{
  test('getGhAuthUsername should return string or null', () =>
  {
    const username = getGhAuthUsername();
    expect(username === null || typeof username === 'string').toBe(true);
  });

  // Note: switchAuth is hard to test without user interaction
  // Integration tests could be added later if needed
});
