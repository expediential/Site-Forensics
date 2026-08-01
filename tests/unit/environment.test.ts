import { describe, expect, it } from 'vitest';

import { resolveBuildEnvironment } from '@/config/environment';

describe('resolveBuildEnvironment', () => {
  it('defaults a development build to the development channel', () => {
    expect(resolveBuildEnvironment('development', undefined)).toEqual({
      mode: 'development',
      releaseChannel: 'development',
      isDevelopment: true,
      isProduction: false,
    });
  });

  it('uses an explicit preview channel', () => {
    expect(resolveBuildEnvironment('production', 'preview').releaseChannel).toBe('preview');
  });

  it('rejects unsupported public environment values', () => {
    expect(() => resolveBuildEnvironment('development', 'secret')).toThrow(
      'Invalid VITE_BROWSERSCOPE_RELEASE_CHANNEL value: secret.',
    );
  });
});
