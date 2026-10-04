/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import GitHubException from "./github.exception.ts";

export default class GitHubJson {
  public static object(value: unknown, context: string): Readonly<Record<string, unknown>> {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new GitHubException(`${context} must be an object.`);
    return Object.fromEntries(Object.entries(value));
  }

  public static array(value: unknown, context: string): readonly unknown[] {
    if (!Array.isArray(value))
      throw new GitHubException(`${context} must be an array.`);
    return [...value];
  }

  public static child(source: Readonly<Record<string, unknown>>, key: string, context: string): Readonly<Record<string, unknown>> {
    return GitHubJson.object(source[key], `${context}.${key}`);
  }

  public static nullableChild(source: Readonly<Record<string, unknown>>, key: string, context: string): Readonly<Record<string, unknown>> | null {
    return source[key] === null ? null : GitHubJson.child(source, key, context);
  }

  public static children(source: Readonly<Record<string, unknown>>, key: string, context: string): readonly Readonly<Record<string, unknown>>[] {
    return GitHubJson.array(source[key], `${context}.${key}`).map((t, index) => GitHubJson.object(t, `${context}.${key}[${index}]`));
  }

  public static text(source: Readonly<Record<string, unknown>>, key: string, context: string): string {
    const value = source[key];
    if (typeof value !== "string")
      throw new GitHubException(`${context}.${key} must be text.`);
    return value;
  }

  public static nullableText(source: Readonly<Record<string, unknown>>, key: string, context: string): string | null {
    return source[key] === null ? null : GitHubJson.text(source, key, context);
  }

  public static number(source: Readonly<Record<string, unknown>>, key: string, context: string): number {
    const value = source[key];
    if (typeof value !== "number" || !Number.isInteger(value))
      throw new GitHubException(`${context}.${key} must be a whole number.`);
    return value;
  }

  public static flag(source: Readonly<Record<string, unknown>>, key: string, context: string): boolean {
    const value = source[key];
    if (typeof value !== "boolean")
      throw new GitHubException(`${context}.${key} must be true or false.`);
    return value;
  }

  public static date(source: Readonly<Record<string, unknown>>, key: string, context: string): Date {
    const text = GitHubJson.text(source, key, context);
    const value = new Date(text);
    if (Number.isNaN(value.getTime()))
      throw new GitHubException(`${context}.${key} must be a date.`);
    return value;
  }

  public static nullableDate(source: Readonly<Record<string, unknown>>, key: string, context: string): Date | null {
    return source[key] === null ? null : GitHubJson.date(source, key, context);
  }
}
