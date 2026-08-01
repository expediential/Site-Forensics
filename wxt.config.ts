import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'BrowserScope',
    description: 'A local-first, evidence-based browser observability extension.',
    version: '0.1.0',
    action: {
      default_title: 'BrowserScope',
    },
    permissions: ['storage'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'browserscope@browserscope.dev',
              strict_min_version: '128.0',
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
