/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly argumentCollectionEmpty: string = "The collection must contain at least one element.";
  public static readonly argumentEmpty: string = "The value cannot be an empty string.";
  public static readonly argumentInvalid: string = "Value does not fall within the expected range.";
  public static readonly argumentNull: string = "Value cannot be null or undefined.";
  public static readonly argumentOutOfRange: string = "The argument must be within the valid range.";
  public static readonly argumentWhitespace: string = "The value cannot be an empty string or composed entirely of whitespace.";
  public static readonly indexOutOfRange: string = "The index must be within the valid range.";

  public static argumentMessage(message: string, parameterName?: string): string {
    if (Object.isUndefined(parameterName))
      return message;

    return `${message} (Parameter '${parameterName}')`;
  }
}
