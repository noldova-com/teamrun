/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * A compile-time projection whose string members evaluate to their own names
 * when used by a `nameof` selector.
 */
export declare type NameofSelector<T> = { readonly [TName in keyof T]-?: TName; };

/**
 * Returns a compile-time-checked string member name. The selector form must
 * return exactly one selected string member. Invalid runtime input throws
 * `TypeError`; a selector failure is preserved as its cause.
 */
export declare function nameof<T>(name: keyof T & string): string;

/**
 * Returns the name of the single string member selected by the callback.
 */
export declare function nameof<T>(selector: (t: NameofSelector<T>) => keyof T & string): string;

/**
 * A 128-bit globally unique identifier, a UUID as RFC 9562 defines it, held in
 * its canonical form: thirty-two lowercase hexadecimal digits in five hyphenated
 * groups. Instances are immutable and compare by that text, which orders them
 * by byte value. Values are created by the factories; there is no public
 * constructor.
 */
export declare class Guid {
  /**
   * The all-zero identifier, `00000000-0000-0000-0000-000000000000`.
   */
  public static readonly empty: Guid;

  /**
   * The RFC 9562 version digit: `4` for random identifiers, `7` for
   * time-ordered ones, `0` for `empty`.
   */
  public get version(): number;

  /**
   * Creates a random version 4 identifier from the host's operating-system
   * random source.
   */
  public static newGuid(): Guid;

  /**
   * Creates a version 7 identifier whose leading 48 bits carry the timestamp
   * as milliseconds since the Unix epoch, so identifiers created later compare
   * greater, followed by random bits. The timestamp defaults to the current
   * time; one that is not an integer, is negative, or does not fit in 48 bits
   * throws `RangeError`.
   */
  public static createVersion7(timestamp?: number): Guid;

  /**
   * Parses the hyphenated form in either letter case and returns the canonical
   * lowercase value. Any other form, including braces or unhyphenated digits,
   * throws `SyntaxError`.
   */
  public static parse(text: string): Guid;

  /**
   * Parses the hyphenated form in either letter case and returns the canonical
   * lowercase value, or `undefined` when the text is not one.
   */
  public static tryParse(text: string): Guid | undefined;

  /**
   * Returns true when both identifiers hold the same value.
   */
  public equals(other: Guid): boolean;

  /**
   * Orders identifiers by byte value: negative when this one is lower, positive
   * when higher, zero when equal.
   */
  public compareTo(other: Guid): number;

  /**
   * Returns the canonical hyphenated lowercase text.
   */
  public toString(): string;

  private constructor(text: string);
}

declare global {
  /**
   * CONTEXT predicates added to the global `Object` constructor.
   */
  interface ObjectConstructor {
    /**
     * Returns true only for primitive `bigint` values. Boxed values return
     * false. A true result narrows the value to `bigint`. A CONTEXT addition
     * to the standard `Object` constructor.
     */
    isBigInt(value: unknown): value is bigint;

    /**
     * Returns true only for primitive Boolean values. Boxed values return
     * false. A true result narrows the value to `boolean`. A CONTEXT addition
     * to the standard `Object` constructor.
     */
    isBoolean(value: unknown): value is boolean;

    /**
     * Returns true for values classified as functions, including ordinary
     * functions and class constructors. It does not promise that the value can
     * be invoked without `new`. A CONTEXT addition to the standard `Object`
     * constructor.
     */
    isFunction(value: unknown): value is Function;

    /**
     * Returns true only when the value is null; a true result narrows the value
     * to `null`. A CONTEXT addition to the standard `Object` constructor.
     */
    isNull(value: unknown): value is null;

    /**
     * Returns true when the value is null or undefined; a true result narrows
     * the value to `null | undefined`. A CONTEXT addition to the standard
     * `Object` constructor.
     */
    isNullOrUndefined(value: unknown): value is null | undefined;

    /**
     * Returns true only for primitive number values, including `NaN` and both
     * infinities. Boxed numbers return false. A CONTEXT addition to the
     * standard `Object` constructor.
     */
    isNumber(value: unknown): value is number;

    /**
     * Returns true for TypeScript's non-null `object` domain. Ordinary objects,
     * arrays, functions, and class constructors return true; null and primitive
     * values return false. A CONTEXT addition to the standard `Object`
     * constructor.
     */
    isObject(value: unknown): value is object;

    /**
     * Returns true only for primitive string values. Boxed strings return false.
     * A true result narrows the value to `string`. A CONTEXT addition to the
     * standard `Object` constructor.
     */
    isString(value: unknown): value is string;

    /**
     * Returns true only for primitive Symbol values. Boxed values return false.
     * A true result narrows the value to `symbol`. A CONTEXT addition to the
     * standard `Object` constructor.
     */
    isSymbol(value: unknown): value is symbol;

    /**
     * Returns true only when the value is undefined; a true result narrows the
     * value to `undefined`. A CONTEXT addition to the standard `Object`
     * constructor.
     */
    isUndefined(value: unknown): value is undefined;
  }

  /**
   * CONTEXT values and operations added to the global `String` constructor.
   */
  interface StringConstructor {
    /**
     * The canonical empty string, `""`. A CONTEXT addition to the standard `String` constructor.
     */
    readonly empty: string;

    /**
     * Replaces each available positional placeholder such as `{0}` or `{12}`
     * with the corresponding string or number argument. Repeated placeholders
     * reuse the same argument; an unrecognized placeholder or one without an
     * available argument remains unchanged. A CONTEXT addition to the standard
     * `String` constructor.
     */
    format(template: string, ...formatArguments: (string | number)[]): string;

    /**
     * Returns true when the value is one ASCII decimal digit from `0` through
     * `9`. Values containing anything other than one UTF-16 code unit return
     * false. A CONTEXT addition to the standard `String` constructor.
     */
    isAsciiDigit(character: string): boolean;

    /**
     * Returns true when the value is one ASCII hexadecimal digit from `0`
     * through `9`, `a` through `f`, or `A` through `F`. Every other value
     * returns false. A CONTEXT addition to the standard `String` constructor.
     */
    isAsciiHexDigit(character: string): boolean;

    /**
     * Determines whether a value is exactly one ASCII letter from `A` through
     * `Z` or `a` through `z`. A CONTEXT addition to the standard `String`
     * constructor.
     */
    isAsciiLetter(character: string): boolean;

    /**
     * Returns true when the value is null, undefined, or the empty string; a false result narrows the value to `string`. A CONTEXT addition to the standard `String` constructor.
     */
    isNullOrEmpty(value: string | null | undefined): value is null | undefined | "";

    /**
     * Returns true when the value is null, undefined, empty, or composed entirely of whitespace. Carries no type predicate: a whitespace-only string is still a `string`, so a predicate would misinform the compiler. A CONTEXT addition to the standard `String` constructor.
     */
    isNullOrWhitespace(value: string | null | undefined): boolean;
  }
}

export { };
