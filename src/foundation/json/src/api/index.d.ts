/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

/**
 * A value JSON can carry: the wire form of every message.
 *
 * @remarks
 * `undefined` is never a JSON value. On the wire an absent key means missing and `null` means
 * explicitly nothing; `JsonReader` keeps that distinction.
 */
export declare type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

/**
 * A JSON object: string keys with JSON values.
 */
export declare type JsonObject = { readonly [key: string]: JsonValue };

/**
 * Raised when text or a value received at a boundary is not a valid protocol message.
 *
 * @remarks
 * Every failure of `JsonReader`, of a message's `fromJson`, and of `WireDecoder` is a
 * `JsonException`. The message is the path, `: `, and the text, so it can be shown to a user as
 * is.
 */
export declare class JsonException extends Exception {
  /**
   * Path of the offending field, such as `$.params.taskId`, or the root path `$` when the whole
   * value is at fault.
   */
  public readonly path: string;

  /**
   * Initializes the exception. The message becomes the path, `: `, and the text.
   * @param text What is wrong, as a sentence without the path, normally a `Resources` message.
   * @param path Path of the offending field, or the root path.
   * @param options Optional options carrying the cause, such as the `SyntaxError` of a failed
   * parse.
   */
  public constructor(text: string, path: string, options?: ExceptionOptions);
}

/**
 * Reads typed fields from untrusted JSON. It is the one place where unknown input is narrowed;
 * every `fromJson` uses it.
 *
 * @remarks
 * A required field must be present and not `null`. An `optional` accessor returns `undefined`
 * for an absent field and still rejects `null`. A `nullable` accessor requires the field and
 * accepts `null`. Unknown fields are ignored, so peers of neighbouring protocol versions can talk.
 * Every failure is a `JsonException` whose path names the field.
 *
 * @example
 * ```ts
 * const reader = JsonReader.parse(line);
 * const id = reader.readNonBlankString("id");
 * const detail = reader.readOptionalString("detail"); // undefined when absent
 * ```
 */
export declare class JsonReader {
  /**
   * Path of the object this reader reads, such as `$` or `$.params.version`; field paths are
   * built beneath it.
   */
  public readonly path: string;

  /**
   * Parses text as JSON and returns a reader over the resulting object.
   * @param text The JSON text, normally one line received from a peer.
   * @param path Path to report for the parsed value; the root path `$` by default.
   * @returns A reader over the parsed object.
   * @throws JsonException when the text is not valid JSON (the `SyntaxError` is the cause) or
   * the parsed value is not an object.
   */
  public static parse(text: string, path?: string): JsonReader;

  /**
   * Returns a reader over an untrusted value that must be a JSON object.
   * @param value The untrusted value, such as a structured-clone payload.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns A reader over the narrowed object.
   * @throws JsonException when the value is not a JSON object or contains anything JSON
   * cannot carry, including circular references.
   */
  public static fromValue(value: unknown, path?: string): JsonReader;

  /**
   * Narrows an untrusted value to JSON, preserving keys such as `__proto__` as data.
   * @param value The untrusted value; repeated references are allowed unless they form a cycle.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The value as JSON; object members whose value is `undefined` are dropped.
   * @throws JsonException for `undefined`, functions, symbols, bigints, and non-finite
   * numbers, or circular references, at the path of the offending member.
   */
  public static toJsonValue(value: unknown, path?: string): JsonValue;

  /**
   * Returns the narrowed object this reader reads from.
   * @returns The object, as JSON.
   */
  public toJson(): JsonObject;

  /**
   * Reports whether a field is present, with any value including `null`.
   * @param name The field's name.
   * @returns `true` when the field exists.
   */
  public hasField(name: string): boolean;

  /**
   * Reads a required string field.
   * @param name The field's name.
   * @returns The string, possibly empty.
   * @throws JsonException when the field is absent, `null`, or not a string.
   */
  public readString(name: string): string;

  /**
   * Reads a required string field that must not be blank.
   * @param name The field's name.
   * @returns The string, which is not blank.
   * @throws JsonException when the field is absent, `null`, not a string, or empty or whitespace.
   */
  public readNonBlankString(name: string): string;

  /**
   * Reads an optional string field.
   * @param name The field's name.
   * @returns The string, or `undefined` when the field is absent.
   * @throws JsonException when the field is present but `null` or not a string.
   */
  public readOptionalString(name: string): string | undefined;

  /**
   * Reads a required string field that may be explicitly `null`.
   * @param name The field's name.
   * @returns The string, or `null` when the field is `null`.
   * @throws JsonException when the field is absent or neither a string nor `null`.
   */
  public readNullableString(name: string): string | null;

  /**
   * Reads a required number field.
   * @param name The field's name.
   * @returns The number, always finite.
   * @throws JsonException when the field is absent, `null`, or not a number.
   */
  public readNumber(name: string): number;

  /**
   * Reads a required integer field.
   * @param name The field's name.
   * @returns The integer.
   * @throws JsonException when the field is absent, `null`, not a number, or not an integer.
   */
  public readInteger(name: string): number;

  /**
   * Reads a required field that is an integer or `null`.
   * @param name The field's name.
   * @returns The integer, or `null` when the field is `null`.
   * @throws JsonException when the field is absent or not an integer.
   */
  public readNullableInteger(name: string): number | null;

  /**
   * Reads a required array of strings.
   * @param name The field's name.
   * @returns The strings, in order; empty for an empty array.
   * @throws JsonException when the field is absent, `null`, or not an array, or when an item is
   * not a string; the path names the item.
   */
  public readStringArray(name: string): readonly string[];

  /**
   * Reads a required array of objects as nested readers.
   * @param name The field's name.
   * @returns One reader per item, in order, each with the item's path such as `$.options.1`; empty
   * for an empty array.
   * @throws JsonException when the field is absent, `null`, or not an array, or when an item is
   * not an object; the path names the item.
   */
  public readObjectArray(name: string): readonly JsonReader[];

  /**
   * Reads a required field that is an object or `null`.
   * @param name The field's name.
   * @returns A reader over the nested object, or `null` when the field is `null`.
   * @throws JsonException when the field is absent or neither an object nor `null`.
   */
  public readNullableObject(name: string): JsonReader | null;

  /**
   * Reads a required boolean field.
   * @param name The field's name.
   * @returns The boolean.
   * @throws JsonException when the field is absent, `null`, or not a boolean.
   */
  public readBoolean(name: string): boolean;

  /**
   * Reads a required object field as a nested reader.
   * @param name The field's name.
   * @returns A reader over the nested object whose path is this reader's path plus the name.
   * @throws JsonException when the field is absent, `null`, or not an object.
   */
  public readObject(name: string): JsonReader;

  /**
   * Reads a required string field that must be one of a set of values, such as an enum's values.
   * @param name The field's name.
   * @param values The accepted values.
   * @returns The matching value, typed as one of `values`.
   * @throws JsonException when the field is absent, `null`, not a string, or not among the
   * values.
   */
  public readOneOf<T extends string>(name: string, values: readonly T[]): T;

  /**
   * Reads a required field of any JSON type.
   * @param name The field's name.
   * @returns The field's value, including `null` when the field is `null`.
   * @throws JsonException when the field is absent.
   */
  public readValue(name: string): JsonValue;
}
