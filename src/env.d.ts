/// <reference types="vite/client" />
/// <reference types="wxt/client" />

interface ImportMetaEnv {
  readonly VITE_BROWSERSCOPE_RELEASE_CHANNEL?: 'development' | 'preview' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
