import { analyzeSecurityHeaders } from '@/core/header-analysis';

export default defineBackground({
  type: 'module',
  main() {
    const pendingTabs = new Set<number>();
    browser.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (details.type !== 'main_frame' || !pendingTabs.delete(details.tabId)) return;
        const analysis = analyzeSecurityHeaders(
          details.url,
          new Date().toISOString(),
          details.responseHeaders ?? [],
        );
        void browser.storage.local.set({ 'browserscope.lastHeaderAnalysis': analysis });
        void browser.action.setBadgeText({
          tabId: details.tabId,
          text: analysis.findings.length === 0 ? 'OK' : String(analysis.findings.length),
        });
      },
      { urls: ['<all_urls>'], types: ['main_frame'] },
      ['responseHeaders'],
    );
    browser.action.onClicked.addListener((tab) => {
      if (tab.id === undefined || tab.url === undefined || !/^https?:/u.test(tab.url)) return;
      const tabId = tab.id;
      pendingTabs.add(tabId);
      void browser.tabs.reload(tabId).catch(() => pendingTabs.delete(tabId));
    });
  },
});
