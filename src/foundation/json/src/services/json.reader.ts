/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { JsonException } from "../exceptions/json.exception.js";
import { Resources } from "../resources.js";
import type { JsonObject } from "../types/json-object.js";
import type { JsonValue } from "../types/json-value.js";

export class JsonReader {
  private readonly value: JsonObject;

  public readonly path: string;

  private constructor(value: JsonObject, path: string) {
    this.value = value;
    this.path = path;
  }

  public static parse(text: string, path: string = Resources.rootPath): JsonReader {
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    }
    catch (error) {
      throw new JsonException(Resources.invalidJsonText, path, new ExceptionOptions(error));
    }

    return JsonReader.fromValue(parsed, path);
  }

  public static fromValue(value: unknown, path: string = Resources.rootPath): JsonReader {
    const json = JsonReader.toJsonValue(value, path);

    if (!JsonReader.isObject(json))
      throw new JsonException(Resources.notObject, path);

    return new JsonReader(json, path);
  }

  /**
   * Narrows an untrusted value to JSON, preserving keys such as `__proto__` as data.
   * @param value The untrusted value; repeated references are allowed unless they form a cycle.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The value as JSON; object members whose value is `undefined` are dropped.
   * @throws JsonException for `undefined`, functions, symbols, bigints, non-finite numbers,
   * or circular references, at the path of the offending member.
   */
  public static toJsonValue(value: unknown, path: string = Resources.rootPath): JsonValue {
    return JsonReader.convertToJsonValue(value, path, new Set<object>());
  }

  public toJson(): JsonObject {
    return this.value;
  }

  public hasField(name: string): boolean {
    return Object.hasOwn(this.value, name);
  }

  public readString(name: string): string {
    const field = this.readRequired(name);

    if (!Object.isString(field))
      this.throwWrongTypeException(name, Resources.stringTypeName);

    return field;
  }

  public readNonBlankString(name: string): string {
    const text = this.readString(name);

    if (String.isNullOrWhitespace(text))
      throw new JsonException(Resources.blankString, this.formatFieldPath(name));
    
    return text;
  }

  public readOptionalString(name: string): string | undefined {
    return this.hasField(name) ? this.readString(name) : undefined;
  }

  public readNullableString(name: string): string | null {
    return Object.isNull(this.readRequiredOrNull(name)) ? null : this.readString(name);
  }

  public readNumber(name: string): number {
    const field = this.readRequired(name);

    if (!Object.isNumber(field))
      this.throwWrongTypeException(name, Resources.numberTypeName);
    
    return field;
  }

  public readInteger(name: string): number {
    const value = this.readNumber(name);

    if (!Number.isInteger(value))
      throw new JsonException(Resources.notInteger, this.formatFieldPath(name));
    
    return value;
  }

  public readNullableInteger(name: string): number | null {
    return Object.isNull(this.readRequiredOrNull(name)) ? null : this.readInteger(name);
  }

  public readBoolean(name: string): boolean {
    const field = this.readRequired(name);

    if (!Object.isBoolean(field))
      this.throwWrongTypeException(name, Resources.booleanTypeName);
    
    return field;
  }

  public readObject(name: string): JsonReader {
    const field = this.readRequired(name);

    if (!JsonReader.isObject(field))
      this.throwWrongTypeException(name, Resources.objectTypeName);
    
    return new JsonReader(field, this.formatFieldPath(name));
  }

  public readNullableObject(name: string): JsonReader | null {
    return Object.isNull(this.readRequiredOrNull(name)) ? null : this.readObject(name);
  }

  public readStringArray(name: string): readonly string[] {
    const field = this.readRequired(name);
    if (!Array.isArray(field))
      this.throwWrongTypeException(name, Resources.arrayTypeName);

    return field.map((t, index) => {
      if (!Object.isString(t))
        throw new JsonException(Resources.formatWrongType(Resources.stringTypeName), this.formatItemPath(name, index));
      return t;
    });
  }

  public readObjectArray(name: string): readonly JsonReader[] {
    const field = this.readRequired(name);
    if (!Array.isArray(field))
      this.throwWrongTypeException(name, Resources.arrayTypeName);
    
    return field.map((t, index) => {
      const path = this.formatItemPath(name, index);
      if (!JsonReader.isObject(t))
        throw new JsonException(Resources.formatWrongType(Resources.objectTypeName), path);
      return new JsonReader(t, path);
    });
  }

  public readOneOf<T extends string>(name: string, values: readonly T[]): T {
    const text = this.readString(name);
    const match = values.find(t => t === text);

    if (Object.isUndefined(match))
      throw new JsonException(Resources.formatNotOneOf(values), this.formatFieldPath(name));

    return match;
  }

  public readValue(name: string): JsonValue {
    return this.readRequiredOrNull(name);
  }

  private readRequired(name: string): JsonValue {
    const field = this.readRequiredOrNull(name);

    if (Object.isNull(field))
      throw new JsonException(Resources.unexpectedNull, this.formatFieldPath(name));

    return field;
  }

  private readRequiredOrNull(name: string): JsonValue {
    if (!this.hasField(name))
      throw new JsonException(Resources.missingField, this.formatFieldPath(name));
    
    return this.value[name] as JsonValue;
  }

  private throwWrongTypeException(name: string, expected: string): never {
    throw new JsonException(Resources.formatWrongType(expected), this.formatFieldPath(name));
  }

  private formatFieldPath(name: string): string {
    return JsonReader.formatChildPath(this.path, name);
  }

  private formatItemPath(name: string, index: number): string {
    return JsonReader.formatChildPath(this.formatFieldPath(name), String(index));
  }

  private static convertToJsonValue(value: unknown, path: string, ancestors: Set<object>): JsonValue {
    if (Object.isNull(value) || Object.isString(value) || Object.isBoolean(value))
      return value;

    if (Object.isNumber(value)) {
      if (!Number.isFinite(value))
        throw new JsonException(Resources.formatNotJsonValue(String(value)), path);
      return value;
    }

    if (Object.isObject(value) && !Object.isFunction(value)) {
      if (ancestors.has(value))
        throw new JsonException(Resources.circularReference, path);

      ancestors.add(value);
      let result: JsonValue;
      if (Array.isArray(value))
        result = value.map((t, index) => JsonReader.convertToJsonValue(t, JsonReader.formatChildPath(path, String(index)), ancestors));
      else {
        const object: Record<string, JsonValue> = {};
        for (const [key, member] of Object.entries(value as Record<string, unknown>))
          if (!Object.isUndefined(member))
            Object.defineProperty(object, key, {
              value: JsonReader.convertToJsonValue(member, JsonReader.formatChildPath(path, key), ancestors),
              enumerable: true,
              writable: true,
              configurable: true
            });
        result = object;
      }
      ancestors.delete(value);
      return result;
    }

    throw new JsonException(Resources.formatNotJsonValue(typeof value), path);
  }

  private static formatChildPath(parent: string, child: string): string {
    return `${parent}${Resources.pathSeparator}${child}`;
  }

  private static isObject(value: JsonValue): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }
}
