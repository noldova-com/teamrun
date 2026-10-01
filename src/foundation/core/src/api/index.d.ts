/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * A compile-time projection whose string members evaluate to their own names
 * when a `nameof` selector reads them.
 */
export declare type NameofSelector<T> = { readonly [TName in keyof T]-?: TName; };

/**
 * Returns a compile-time-checked string member name.
 *
 * @param name The member name, checked against the string keys of `T` at
 * compile time.
 * @returns The member name, unchanged.
 */
export declare function nameof<T>(name: keyof T & string): string;

/**
 * Returns the name of the single string member a selector reads.
 *
 * @param selector A callback that reads exactly one string member of its
 * argument and returns that member's value, such as `t => t.empty`. It is called
 * once, synchronously.
 * @returns The name of the member the selector read.
 * @throws TypeError when the selector reads no member, more than one member or
 * a symbol member, or returns something other than the member it read. A
 * failure thrown by the selector is preserved as the `cause`.
 */
export declare function nameof<T>(selector: (t: NameofSelector<T>) => keyof T & string): string;

declare global {
  /**
   * Value checks foundation adds to the global `Object` constructor. Importing
   * the package installs them as non-writable, non-enumerable members.
   */
  interface ObjectConstructor {
    /**
     * Checks for a primitive Boolean value.
     *
     * @param value Any value.
     * @returns True for `true` and `false`; false for everything else,
     * including boxed `Boolean` objects. A true result narrows the value to
     * `boolean`.
     */
    isBoolean(value: unknown): value is boolean;

    /**
     * Checks for a value JavaScript classifies as a function.
     *
     * @param value Any value.
     * @returns True for ordinary functions, arrow functions and class
     * constructors. It does not promise that the value can be called without
     * `new`.
     */
    isFunction(value: unknown): value is Function;

    /**
     * Checks for `null`.
     *
     * @param value Any value.
     * @returns True only for `null`; a true result narrows the value to `null`.
     */
    isNull(value: unknown): value is null;

    /**
     * Checks for `null` or `undefined`.
     *
     * @param value Any value.
     * @returns True for `null` and `undefined`; a true result narrows the value
     * to `null | undefined`.
     */
    isNullOrUndefined(value: unknown): value is null | undefined;

    /**
     * Checks for a primitive number value.
     *
     * @param value Any value.
     * @returns True for every primitive number, including `NaN` and both
     * infinities; false for boxed `Number` objects.
     */
    isNumber(value: unknown): value is number;

    /**
     * Checks for a value in TypeScript's non-null `object` domain.
     *
     * @param value Any value.
     * @returns True for ordinary objects, arrays, functions and class
     * constructors; false for `null` and every primitive value.
     */
    isObject(value: unknown): value is object;

    /**
     * Checks for a primitive string value.
     *
     * @param value Any value.
     * @returns True for primitive strings; false for boxed `String` objects. A
     * true result narrows the value to `string`.
     */
    isString(value: unknown): value is string;

    /**
     * Checks for `undefined`.
     *
     * @param value Any value.
     * @returns True only for `undefined`; a true result narrows the value to
     * `undefined`.
     */
    isUndefined(value: unknown): value is undefined;
  }

  /**
   * Values and checks foundation adds to the global `String` constructor.
   * Importing the package installs them as non-writable, non-enumerable
   * members.
   */
  interface StringConstructor {
    /**
     * The canonical empty string, `""`.
     */
    readonly empty: string;

    /**
     * Checks for a missing or empty string.
     *
     * @param value A string, `null` or `undefined`.
     * @returns True for `null`, `undefined` and the empty string. A false
     * result narrows the value to `string`.
     */
    isNullOrEmpty(value: string | null | undefined): value is null | undefined | "";

    /**
     * Checks for a missing string or one with no visible characters.
     *
     * @param value A string, `null` or `undefined`.
     * @returns True for `null`, `undefined`, the empty string and a string of
     * whitespace only. It narrows nothing, because a whitespace-only value is
     * still a `string`.
     */
    isNullOrWhitespace(value: string | null | undefined): boolean;
  }
}

export { };
