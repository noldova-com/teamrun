/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly asciiDigitNine: string = "9";
  public static readonly asciiDigitZero: string = "0";
  public static readonly asciiLowercaseA: string = "a";
  public static readonly asciiLowercaseF: string = "f";
  public static readonly asciiLowercaseZ: string = "z";
  public static readonly asciiUppercaseA: string = "A";
  public static readonly asciiUppercaseF: string = "F";
  public static readonly asciiUppercaseZ: string = "Z";
  public static readonly decimalRadix: number = 10;
  public static readonly formatClosingBrace: string = "}";
  public static readonly formatOpeningBrace: string = "{";
  public static readonly guidByteCount: number = 16;
  public static readonly guidEmptyText: string = "00000000-0000-0000-0000-000000000000";
  public static readonly guidGroupLengths: readonly number[] = [8, 4, 4, 4, 12];
  public static readonly guidGroupSeparator: string = "-";
  public static readonly guidPattern: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  public static readonly guidTextInvalid: string = "The text is not a Guid in the hyphenated form of thirty-two hexadecimal digits.";
  public static readonly guidTimestampInvalid: string = "The timestamp must be an integer number of milliseconds since the Unix epoch that fits in 48 bits.";
  public static readonly guidTimestampLowByteIndex: number = 4;
  public static readonly guidTimestampLowRange: number = 65536;
  public static readonly guidTimestampMaximum: number = 281474976710655;
  public static readonly guidVariantByteIndex: number = 8;
  public static readonly guidVariantMarker: number = 0x80;
  public static readonly guidVariantMask: number = 0x3f;
  public static readonly guidVersion4Marker: number = 0x40;
  public static readonly guidVersion7Marker: number = 0x70;
  public static readonly guidVersionByteIndex: number = 6;
  public static readonly guidVersionCharacterIndex: number = 14;
  public static readonly guidVersionMask: number = 0x0f;
  public static readonly hexadecimalByteWidth: number = 2;
  public static readonly hexadecimalPadding: string = "0";
  public static readonly hexadecimalRadix: number = 16;
  public static readonly nameofArgumentInvalid: string = "The value must be a string member name or a selector that returns exactly one selected string member.";
  public static readonly typeofBigInt: string = "bigint";
  public static readonly typeofBoolean: string = "boolean";
  public static readonly typeofFunction: string = "function";
  public static readonly typeofNumber: string = "number";
  public static readonly typeofObject: string = "object";
  public static readonly typeofString: string = "string";
  public static readonly typeofSymbol: string = "symbol";
}
