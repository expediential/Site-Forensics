import type { JsonObject, JsonValue } from '../types/index.js';

declare const eventIdBrand: unique symbol;
declare const eventTypeBrand: unique symbol;
declare const eventHashBrand: unique symbol;

/** A validated, portable event identifier. */
export type EventId = string & { readonly [eventIdBrand]: 'EventId' };

/** A validated event type identifier in dotted namespace notation. */
export type EventType = string & { readonly [eventTypeBrand]: 'EventType' };

/** A SHA-256 digest of canonical event content. */
export type EventHash = string & { readonly [eventHashBrand]: 'EventHash' };

/** Positive integer schema version for a specific event type. */
export type EventVersion = number & { readonly __eventVersion: 'EventVersion' };

/** Canonical ISO-8601 UTC timestamp used by portable event records. */
export type EventTimestamp = string & { readonly __eventTimestamp: 'EventTimestamp' };

/** Event families defined by the BrowserScope evidence architecture. */
export const eventCategories = [
  'analysis',
  'browser_context',
  'document',
  'investigation',
  'network',
  'runtime',
  'storage',
  'system',
  'user',
] as const;

/** Event family defined by the BrowserScope evidence architecture. */
export type EventCategory = (typeof eventCategories)[number];

/** Trusted producer class for a normalized event. */
export const eventSources = [
  'browser-cookie',
  'browser-download',
  'browser-navigation',
  'browser-network',
  'content-dom',
  'main-probe',
  'system',
  'user',
] as const;

/** Trusted producer class for a normalized event. */
export type EventSource = (typeof eventSources)[number];

/** Evidence-backed urgency, not a safety verdict. */
export const eventSeverities = ['info', 'caution', 'important', 'critical'] as const;

/** Evidence-backed urgency, not a safety verdict. */
export type EventSeverity = (typeof eventSeverities)[number];

/** Confidence in the observation or deterministic derivation. */
export const eventConfidences = ['low', 'medium', 'high'] as const;

/** Confidence in the observation or deterministic derivation. */
export type EventConfidence = (typeof eventConfidences)[number];

/** The semantic relationship between an event and a referenced event ID. */
export const eventReferenceRelations = [
  'caused_by',
  'corrects',
  'derived_from',
  'related_to',
  'supersedes',
] as const;

/** The semantic relationship between an event and a referenced event ID. */
export type EventReferenceRelation = (typeof eventReferenceRelations)[number];

/** A compact relationship to another event; referenced event data is never embedded. */
export interface EventReference {
  readonly eventId: EventId;
  readonly relation: EventReferenceRelation;
}

/** Extensible, JSON-safe context supplied with an event. */
export type EventMetadata = JsonObject;

/** Extensible, JSON-safe evidence content supplied with an event. */
export type EventPayload = JsonObject;

/** Recursively readonly event data after event creation. */
export type DeepReadonly<TValue> = TValue extends JsonValue
  ? TValue extends readonly (infer TEntry)[]
    ? readonly DeepReadonly<TEntry>[]
    : TValue extends object
      ? { readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]> }
      : TValue
  : TValue;

/** Complete immutable evidence record consumed by every future BrowserScope subsystem. */
export interface BaseEvent<
  TPayload extends EventPayload = EventPayload,
  TMetadata extends EventMetadata = EventMetadata,
> {
  readonly id: EventId;
  readonly schemaVersion: EventVersion;
  readonly timestamp: EventTimestamp;
  readonly source: EventSource;
  readonly category: EventCategory;
  readonly type: EventType;
  readonly severity: EventSeverity;
  readonly confidence: EventConfidence;
  readonly payload: DeepReadonly<TPayload>;
  readonly metadata: DeepReadonly<TMetadata>;
  readonly references: readonly EventReference[];
  readonly hash: EventHash;
  readonly createdAt: EventTimestamp;
}

/** Input required to construct a hashed immutable event. */
export interface BaseEventInput<
  TPayload extends EventPayload = EventPayload,
  TMetadata extends EventMetadata = EventMetadata,
> {
  readonly id: EventId;
  readonly schemaVersion: EventVersion;
  readonly timestamp: EventTimestamp;
  readonly source: EventSource;
  readonly category: EventCategory;
  readonly type: EventType;
  readonly severity: EventSeverity;
  readonly confidence: EventConfidence;
  readonly payload: TPayload;
  readonly metadata: TMetadata;
  readonly references: readonly EventReference[];
  readonly createdAt: EventTimestamp;
}
