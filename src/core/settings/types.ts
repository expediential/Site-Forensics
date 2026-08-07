/** Versioned retention choices permitted for locally persisted BrowserScope data. */
export const retentionPolicies = ['immediate', '24_hours', '7_days', '30_days'] as const;

/** User-selected local evidence retention period. */
export type RetentionPolicy = (typeof retentionPolicies)[number];

/** The first stable, intentionally small BrowserScope preference schema. */
export interface BrowserScopeSettings {
  readonly schemaVersion: 1;
  readonly retentionPolicy: RetentionPolicy;
}

/** Settings fields callers may change through the validated manager. */
export type SettingsUpdate = Partial<Pick<BrowserScopeSettings, 'retentionPolicy'>>;

/** Default privacy-preserving settings for a new installation. */
export const defaultBrowserScopeSettings: BrowserScopeSettings = Object.freeze({
  schemaVersion: 1,
  retentionPolicy: '24_hours',
});
