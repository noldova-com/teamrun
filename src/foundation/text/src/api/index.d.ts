/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Recognizes the characters a kind of text treats as ending a line.
 */
export declare abstract class LineTerminator {
  /**
   * Measures the line break that starts at an index.
   *
   * @param value The text to inspect.
   * @param index The position to inspect; an integer from zero to the text's
   * length.
   * @returns The number of characters the line break at the index takes: 2
   * for a two-character break, 1 for a one-character break, and 0 when no
   * line break starts there, including at the end of the text.
   * @throws ArgumentOutOfRangeException synchronously when the index is not an
   * integer within the text.
   * @example
   * ```ts
   * import { EcmaScriptLineTerminator, type LineTerminator } from "@noldova/teamrun-foundation-text";
   *
   * export function countLines(text: string, terminator: LineTerminator): number {
   *   let count = 1;
   *   for (let index = 0; index < text.length; index++) {
   *     const length = terminator.getLength(text, index);
   *     if (length > 0) {
   *       count++;
   *       index += length - 1;
   *     }
   *   }
   *   return count;
   * }
   *
   * export const lineCount: number = countLines("one\r\ntwo\nthree", new EcmaScriptLineTerminator());
   * ```
   */
  public abstract getLength(value: string, index: number): 0 | 1 | 2;

  /**
   * Checks whether a character ends a line.
   *
   * @param character One character.
   * @returns True when the character ends a line on its own or starts a
   * two-character line break.
   * @example
   * ```ts
   * import { EcmaScriptLineTerminator, type LineTerminator } from "@noldova/teamrun-foundation-text";
   *
   * export function endsWithLineBreak(text: string, terminator: LineTerminator): boolean {
   *   return text.length > 0 && terminator.isLineTerminator(text.charAt(text.length - 1));
   * }
   *
   * export const ends: boolean = endsWithLineBreak("done\n", new EcmaScriptLineTerminator());
   * ```
   */
  public abstract isLineTerminator(character: string): boolean;
}

/**
 * The line terminators of ECMAScript source text: line feed, carriage return,
 * the carriage return and line feed pair, the line separator U+2028 and the
 * paragraph separator U+2029. Source maps count lines by these.
 */
export declare class EcmaScriptLineTerminator extends LineTerminator {
  /**
   * Measures the line break that starts at an index.
   *
   * @param value The text to inspect.
   * @param index The position to inspect; an integer from zero to the text's
   * length.
   * @returns 2 for a carriage return followed by a line feed, 1 for any other
   * line terminator, and 0 when none starts at the index.
   * @throws ArgumentOutOfRangeException synchronously when the index is not an
   * integer within the text.
   * @example
   * ```ts
   * import { EcmaScriptLineTerminator } from "@noldova/teamrun-foundation-text";
   *
   * export const length: 0 | 1 | 2 = new EcmaScriptLineTerminator().getLength("one\r\ntwo", 3);
   * ```
   */
  public override getLength(value: string, index: number): 0 | 1 | 2;

  /**
   * Checks whether a character is an ECMAScript line terminator.
   *
   * @param character One character.
   * @returns True for a line feed, carriage return, line separator or
   * paragraph separator.
   * @example
   * ```ts
   * import { EcmaScriptLineTerminator } from "@noldova/teamrun-foundation-text";
   *
   * export const isTerminator: boolean = new EcmaScriptLineTerminator().isLineTerminator("\u2028");
   * ```
   */
  public override isLineTerminator(character: string): boolean;
}
