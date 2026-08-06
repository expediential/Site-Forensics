import { KernelError } from '../errors/index.js';
import type { JsonObject, JsonValue } from '../types/index.js';

/** Returns whether a runtime value is a finite, acyclic JSON value. */
export function isJsonValue(value: unknown): value is JsonValue {
  return isJsonValueInternal(value, new Set<object>());
}

/** Throws a typed error when a runtime value cannot cross an SDK JSON boundary. */
export function assertJsonValue(value: unknown): asserts value is JsonValue {
  if (!isJsonValue(value)) {
    throw new KernelError('INVALID_JSON_VALUE', 'Value is not a finite, acyclic JSON value.');
  }
}

/** Returns whether a runtime value is a plain JSON object. */
export function isJsonObject(value: unknown): value is JsonObject {
  return isJsonObjectInternal(value, new Set<object>());
}

/** Returns an independent JSON-compatible copy suitable for immutable records. */
export function cloneJsonValue<TValue extends JsonValue>(value: TValue): TValue {
  assertJsonValue(value);
  return cloneJsonValueInternal(value) as TValue;
}

/** Freezes every reachable JSON object and array, returning the original value. */
export function deepFreezeJson<TValue extends JsonValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreezeJson(entry);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      deepFreezeJson(entry);
    }
  }

  return Object.freeze(value);
}

/** Serializes JSON with lexicographically sorted object keys for deterministic hashing/export. */
export function stableStringify(value: JsonValue): string {
  assertJsonValue(value);
  return stableStringifyInternal(value);
}

function isJsonValueInternal(value: unknown, ancestors: Set<object>): value is JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value !== 'object' || Array.isArray(value) === false) {
    return isJsonObjectInternal(value, ancestors);
  }

  if (ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);
  const isValid = value.every((entry) => isJsonValueInternal(entry, ancestors));
  ancestors.delete(value);
  return isValid;
}

function isJsonObjectInternal(value: unknown, ancestors: Set<object>): value is JsonObject {
  if (
    value === null ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }

  if (ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);
  const isValid = Object.values(value).every((entry) => isJsonValueInternal(entry, ancestors));
  ancestors.delete(value);
  return isValid;
}

function cloneJsonValueInternal(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonValueInternal(entry));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJsonValueInternal(entry)]),
    );
  }

  return value;
}

function stableStringifyInternal(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringifyInternal(entry)).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const object = value as JsonObject;
    return `{${Object.entries(object)
      .sort(([leftKey], [rightKey]) => {
        if (leftKey < rightKey) {
          return -1;
        }

        if (leftKey > rightKey) {
          return 1;
        }

        return 0;
      })
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringifyInternal(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
