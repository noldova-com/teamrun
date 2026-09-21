/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

declare global {
  /**
   * Text operations added to the global `String` constructor.
   */
  interface StringConstructor {
    /**
     * Returns true when the value is the ASCII binary digit `0` or `1`.
     * Every other value returns false.
     */
    isAsciiBinaryDigit(character: string): boolean;

    /**
     * Returns true when the value is one ASCII octal digit from `0` through
     * `7`. Every other value returns false.
     */
    isAsciiOctalDigit(character: string): boolean;
  }
}

/**
 * Defines how one source language recognizes line terminators in UTF-16 text.
 */
export declare abstract class LineTerminator {
  /**
   * Returns the number of UTF-16 code units in the terminator beginning at the
   * given index. A non-terminator returns zero.
   */
  public abstract getLength(value: string, index: number): 0 | 1 | 2;

  /**
   * Returns true when the value is one complete line-terminator code unit.
   */
  public abstract isLineTerminator(character: string): boolean;
}

/**
 * Recognizes the ECMAScript line-terminator sequences CRLF, CR, LF, U+2028,
 * and U+2029.
 */
export declare class EcmaScriptLineTerminator extends LineTerminator {
  /**
   * Returns two for CRLF; one for CR, LF, U+2028, or U+2029; and zero for every
   * other position, including the end of the string. An invalid index throws
   * `ArgumentOutOfRangeException`.
   */
  public override getLength(value: string, index: number): 0 | 1 | 2;

  /**
   * Returns true for CR, LF, U+2028, or U+2029.
   */
  public override isLineTerminator(character: string): boolean;
}

/**
 * An immutable UTF-16 character view backed by an existing string. Creating
 * the view or slicing it does not copy the represented characters.
 */
export declare class ReadOnlyStringSpan {
  /**
   * The canonical empty span.
   */
  public static readonly empty: ReadOnlyStringSpan;

  /**
   * The number of UTF-16 code units in the span.
   */
  public readonly length: number;

  /**
   * True when the span contains no UTF-16 code units.
   */
  public readonly isEmpty: boolean;

  /**
   * Initializes a view over the complete source or a contained range. The
   * start and length count UTF-16 code units. An invalid source throws
   * `ArgumentException`; an invalid range throws
   * `ArgumentOutOfRangeException`.
   */
  public constructor(source: string, start?: number, length?: number);

  /**
   * Returns the UTF-16 code unit at the zero-based index as a one-unit string.
   * An invalid index throws `IndexOutOfRangeException`.
   */
  public get(index: number): string;

  /**
   * Creates another zero-copy view over a contained range of this span. When
   * length is omitted, the slice continues through the end of this span.
   * Invalid ranges throw `ArgumentOutOfRangeException`.
   */
  public slice(start: number, length?: number): ReadOnlyStringSpan;

  /**
   * Materializes the represented characters as a string.
   */
  public toString(): string;
}

/**
 * Incrementally collects string fragments and materializes their combined
 * UTF-16 text on demand.
 */
export declare class StringBuilder {
  /**
   * The number of UTF-16 code units in all appended fragments.
   */
  public get length(): number;

  /**
   * Appends the complete value and returns this builder for chaining.
   */
  public append(value: string): this;

  /**
   * Removes every appended fragment and resets the length to zero.
   */
  public clear(): void;

  /**
   * Materializes the appended fragments as one string.
   */
  public toString(): string;
}

/**
 * Classifies Unicode code points using Unicode 15.1 identifier properties.
 */
export declare class UnicodeCodePoint {
  /**
   * Returns true when the value has the Unicode `ID_Start` or
   * `Other_ID_Start` property. Invalid numeric values return false.
   */
  public static isIdentifierStart(value: number): boolean;

  /**
   * Returns true when the value has the Unicode `ID_Continue` property.
   * Invalid numeric values return false.
   */
  public static isIdentifierContinue(value: number): boolean;

  /**
   * Returns true when the value is an integer in the leading-surrogate range
   * from U+D800 through U+DBFF. Invalid numeric values return false.
   */
  public static isLeadingSurrogate(value: number): boolean;

  /**
   * Returns true when the value is an integer in the trailing-surrogate range
   * from U+DC00 through U+DFFF. Invalid numeric values return false.
   */
  public static isTrailingSurrogate(value: number): boolean;
}

export { };
