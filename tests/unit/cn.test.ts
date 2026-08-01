import { describe, expect, it } from 'vitest';

import { cn } from '@/shared/lib/cn';

describe('cn', () => {
  it('merges conflicting Tailwind utility classes deterministically', () => {
    expect(cn('px-2', undefined, 'px-4')).toBe('px-4');
  });
});
