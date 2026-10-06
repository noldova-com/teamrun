/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Options shared by every foundation exception.
 */
export declare class ExceptionOptions implements ErrorOptions {
  /**
   * The failure that led to this one, or `undefined` when there is none.
   */
  public readonly cause: unknown;

  /**
   * Creates options carrying the preceding failure.
   *
   * @param cause The failure that led to the new exception; omit it when there
   * is none.
   * @example
   * ```ts
   * import { ArgumentException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
   *
   * export function rejectPort(port: number, failure: Error): never {
   *   throw new ArgumentException(`Port ${port} is in use.`, "port", new ExceptionOptions(failure));
   * }
   * ```
   */
  public constructor(cause?: unknown);
}

/**
 * The abstract base of every foundation exception. It extends `Error` and keeps
 * the preceding failure as `cause`; each concrete class sets `name` to its own
 * class name, written out, because a minifier renames classes.
 */
export declare abstract class Exception extends Error {
  /**
   * The exception's class name, which each concrete class sets as a string so
   * that the name stays the same in a minified build.
   */
  public abstract override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message The complete message.
   * @param options The preceding failure, if any.
   * @example
   * ```ts
   * import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
   *
   * export class ConfigurationException extends Exception {
   *   public override readonly name: string = "ConfigurationException";
   *
   *   public constructor(message: string, cause?: unknown) {
   *     super(message, new ExceptionOptions(cause));
   *   }
   * }
   * ```
   * @example
   * ```ts
   * import { Exception } from "@noldova/teamrun-foundation-exceptions";
   *
   * // @ts-expect-error
   * new Exception("Only a concrete subclass is thrown.");
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when an argument does not meet the called method's
 * contract.
 */
export declare class ArgumentException extends Exception {
  /**
   * The exception's name, `"ArgumentException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * The name of the offending parameter, when one was given. The message also
   * carries it as `(Parameter 'name')`.
   */
  public readonly parameterName?: string;

  /**
   * Creates the exception.
   *
   * @param message What is wrong with the argument; the canonical
   * invalid-argument text when omitted.
   * @param parameterName The offending parameter's name, appended to the
   * message as `(Parameter 'name')` when given.
   * @param options The preceding failure, if any.
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
   *
   * export function rename(name: string): string {
   *   if (name.length > 64)
   *     throw new ArgumentException("A name has at most 64 characters.", "name");
   *   return name;
   * }
   * ```
   */
  public constructor(message?: string, parameterName?: string, options?: ExceptionOptions);

  /**
   * Requires a string with at least one non-whitespace character.
   *
   * @param value The value to check.
   * @param parameterName The name reported when the value is rejected.
   * @throws ArgumentException synchronously when the value is `null`,
   * `undefined`, empty or whitespace only, with a message naming which.
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
   *
   * export function greet(name: string | null): string {
   *   ArgumentException.throwIfNullOrWhitespace(name, "name");
   *   return `Hello, ${name.trim()}.`;
   * }
   * ```
   */
  public static throwIfNullOrWhitespace(value: string | null | undefined, parameterName: string): asserts value is string;

  /**
   * Requires a collection with at least one element.
   *
   * @param value The collection to check; it is not modified.
   * @param parameterName The name reported when the collection is rejected.
   * @throws ArgumentException synchronously when the collection is empty. A
   * passing collection narrows to a non-empty readonly array.
   * @example
   * ```ts
   * import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
   *
   * export function first(values: readonly number[]): number {
   *   ArgumentException.throwIfEmpty(values, "values");
   *   return values[0];
   * }
   * ```
   */
  public static throwIfEmpty<T>(value: readonly T[], parameterName: string): asserts value is readonly [T, ...T[]];
}

/**
 * The exception thrown when an argument lies outside the range the called
 * method accepts.
 */
export declare class ArgumentOutOfRangeException extends ArgumentException {
  /**
   * The exception's name, `"ArgumentOutOfRangeException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * The rejected value, or `undefined` when it was not given.
   */
  public readonly actualValue: unknown;

  /**
   * Creates the exception.
   *
   * @param parameterName The offending parameter's name, appended to the
   * message when given.
   * @param actualValue The rejected value.
   * @param message What is wrong with the value; the canonical out-of-range
   * text when omitted.
   * @param options The preceding failure, if any.
   * @example
   * ```ts
   * import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
   *
   * export function setVolume(volume: number): number {
   *   if (volume < 0 || volume > 100)
   *     throw new ArgumentOutOfRangeException("volume", volume, "The volume lies between 0 and 100.");
   *   return volume;
   * }
   * ```
   */
  public constructor(parameterName?: string, actualValue?: unknown, message?: string, options?: ExceptionOptions);

  /**
   * Requires a positive integer.
   *
   * @param value The number to check.
   * @param parameterName The name reported when the value is rejected.
   * @param message The message used when the value is rejected; the canonical
   * out-of-range text when omitted.
   * @throws ArgumentOutOfRangeException synchronously when the value is not an
   * integer or is zero or negative, carrying the value as `actualValue`.
   * @example
   * ```ts
   * import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
   *
   * export function take<T>(values: readonly T[], count: number): readonly T[] {
   *   ArgumentOutOfRangeException.throwIfNotPositiveInteger(count, "count");
   *   return values.slice(0, count);
   * }
   * ```
   */
  public static throwIfNotPositiveInteger(value: number, parameterName: string, message?: string): void;
}
