export type ReleaseChannel = 'development' | 'preview' | 'production';

export interface BuildEnvironment {
  readonly mode: string;
  readonly releaseChannel: ReleaseChannel;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
}

const releaseChannels = new Set<ReleaseChannel>(['development', 'preview', 'production']);

export function resolveBuildEnvironment(
  mode: string,
  configuredReleaseChannel: string | undefined,
): BuildEnvironment {
  const releaseChannel =
    configuredReleaseChannel ?? (mode === 'production' ? 'production' : 'development');

  if (!releaseChannels.has(releaseChannel as ReleaseChannel)) {
    throw new Error(
      `Invalid VITE_BROWSERSCOPE_RELEASE_CHANNEL value: ${releaseChannel}. ` +
        'Expected development, preview, or production.',
    );
  }

  return {
    mode,
    releaseChannel: releaseChannel as ReleaseChannel,
    isDevelopment: mode === 'development',
    isProduction: mode === 'production',
  };
}

export const buildEnvironment = resolveBuildEnvironment(
  import.meta.env.MODE,
  import.meta.env.VITE_BROWSERSCOPE_RELEASE_CHANNEL,
);
