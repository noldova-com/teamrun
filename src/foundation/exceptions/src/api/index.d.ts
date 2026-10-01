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
   */
  public constructor(cause?: unknown);
}

/**
 * The abstract base of every foundation exception. It extends `Error`, sets
 * `name` to the concrete class name and keeps the preceding failure as `cause`.
 */
export declare abstract class Exception extends Error {
  /**
   * Creates the exception.
   *
   * @param message The complete message.
   * @param options The preceding failure, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when an argument does not meet the called method's
 * contract.
 */
export declare class ArgumentException extends Exception {
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
   */
  public constructor(message?: string, parameterName?: string, options?: ExceptionOptions);

  /**
   * Requires a string with at least one non-whitespace character.
   *
   * @param value The value to check.
   * @param parameterName The name reported when the value is rejected.
   * @throws ArgumentException synchronously when the value is `null`,
   * `undefined`, empty or whitespace only, with a message naming which.
   */
  public static throwIfNullOrWhitespace(value: string | null | undefined, parameterName: string): asserts value is string;

  /**
   * Requires a collection with at least one element.
   *
   * @param value The collection to check; it is not modified.
   * @param parameterName The name reported when the collection is rejected.
   * @throws ArgumentException synchronously when the collection is empty. A
   * passing collection narrows to a non-empty readonly array.
   */
  public static throwIfEmpty<T>(value: readonly T[], parameterName: string): asserts value is readonly [T, ...T[]];
}

/**
 * The exception thrown when an argument lies outside the range the called
 * method accepts.
 */
export declare class ArgumentOutOfRangeException extends ArgumentException {
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
   */
  public static throwIfNotPositiveInteger(value: number, parameterName: string, message?: string): void;
}
