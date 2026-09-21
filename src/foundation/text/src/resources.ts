/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly asciiDigitOne: string = "1";
  public static readonly asciiDigitSeven: string = "7";
  public static readonly asciiDigitZero: string = "0";
  public static readonly carriageReturn: string = "\r";
  public static readonly lineFeed: string = "\n";
  public static readonly lineSeparator: string = "\u2028";
  public static readonly paragraphSeparator: string = "\u2029";

  public static readonly indexParameterName: string = "index";
  public static readonly lengthParameterName: string = "length";
  public static readonly startParameterName: string = "start";

  public static readonly indexOutOfRange: string = "The index must identify a character within the span.";
  public static readonly lengthInvalid: string = "The span length must be a non-negative integer.";
  public static readonly lineBreakIndexInvalid: string = "The line-break index must be an integer within the string.";
  public static readonly spanOutOfRange: string = "The span must be contained by its source.";
  public static readonly startInvalid: string = "The span start must be an integer within the source range.";
}
