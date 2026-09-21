/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Options shared by every CONTEXT exception. The cause represents the failure
 * that led to this one.
 */
export declare class ExceptionOptions implements ErrorOptions {
  /**
   * The preceding failure, when supplied.
   */
  public readonly cause: unknown;

  /**
   * Initializes the options with an optional preceding failure.
   */
  public constructor(cause?: unknown);
}

/**
 * The abstract base of every CONTEXT exception. Extends `Error`;
 * `name` is set automatically to the concrete class name, and `cause` is the
 * InnerException analogue.
 */
export declare abstract class Exception extends Error {
  /**
   * Initializes the exception with its complete message and optional
   * `ExceptionOptions`.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception that is thrown when an argument does not meet the parameter
 * contract of the called method.
 */
export declare class ArgumentException extends Exception {
  /**
   * The name of the offending parameter, when supplied. It is also composed
   * into the message as `(Parameter 'name')`.
   */
  public readonly parameterName: string | undefined;

  /**
   * Initializes the exception. A missing message defaults to the canonical
   * invalid-argument text.
   */
  public constructor(message?: string, parameterName?: string, options?: ExceptionOptions);

  /**
   * Throws when the value is null, undefined, or the empty string; a passing
   * value narrows to `string`.
   */
  public static throwIfNullOrEmpty(value: string | null | undefined, parameterName: string): asserts value is string;

  /**
   * Throws when the value is null, undefined, empty, or only whitespace; a
   * passing value narrows to `string`.
   */
  public static throwIfNullOrWhitespace(value: string | null | undefined, parameterName: string): asserts value is string;

  /**
   * Throws when the collection contains no elements; a passing value narrows
   * to a non-empty readonly array.
   */
  public static throwIfEmpty<T>(value: readonly T[], parameterName: string): asserts value is readonly [T, ...T[]];
}

/**
 * The exception that is thrown when a null or undefined argument is passed
 * to a method that does not accept one. The constructor takes
 * `parameterName` first, following .NET.
 */
export declare class ArgumentNullException extends ArgumentException {
  /**
   * Initializes the exception. A missing message defaults to the canonical
   * null-argument text.
   */
  public constructor(parameterName?: string, message?: string, options?: ExceptionOptions);

  /**
   * Throws when the value is null or undefined; a passing value narrows to
   * `NonNullable<T>`.
   */
  public static throwIfNull<T>(value: T, parameterName: string): asserts value is NonNullable<T>;
}

/**
 * The exception that is thrown when an argument lies outside the range
 * accepted by the called method.
 */
export declare class ArgumentOutOfRangeException extends ArgumentException {
  /**
   * The rejected value, when supplied.
   */
  public readonly actualValue: unknown;

  /**
   * Initializes the exception. A missing message defaults to the canonical
   * out-of-range text; the parameter name is composed into that message.
   */
  public constructor(parameterName?: string, actualValue?: unknown, message?: string, options?: ExceptionOptions);

  /**
   * Throws when the value is not a positive integer.
   */
  public static throwIfNotPositiveInteger(value: number, parameterName: string, message?: string): void;
}

/**
 * The exception that is thrown when indexed access addresses no element of
 * the target collection or span.
 */
export declare class IndexOutOfRangeException extends Exception {
  /**
   * Initializes the exception. A missing message defaults to the canonical
   * invalid-index text.
   */
  public constructor(message?: string, options?: ExceptionOptions);
}
