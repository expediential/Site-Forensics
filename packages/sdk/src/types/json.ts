/** A JSON scalar that can be safely serialized without custom browser codecs. */
export type JsonPrimitive = boolean | null | number | string;

/** A JSON-compatible value used at SDK trust boundaries. */
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

/** A JSON-compatible array. */
export type JsonArray = readonly JsonValue[];

/** A JSON-compatible object. */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
