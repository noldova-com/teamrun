/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "../intrinsics/nameof.js";
import { Resources } from "../resources.js";

declare global {
  interface StringConstructor {
    readonly empty: string;
    format(template: string, ...formatArguments: (string | number)[]): string;
    isAsciiDigit(character: string): boolean;
    isAsciiHexDigit(character: string): boolean;
    isAsciiLetter(character: string): boolean;
    isNullOrEmpty(value: string | null | undefined): value is null | undefined | "";
    isNullOrWhitespace(value: string | null | undefined): boolean;
  }
}

function isAsciiDigit(character: string): boolean {
  if (character.length !== 1)
    return false;

  return character >= Resources.asciiDigitZero && character <= Resources.asciiDigitNine;
}

function isAsciiHexDigit(character: string): boolean {
  if (character.length !== 1)
    return false;

  return String.isAsciiDigit(character)
    || character >= Resources.asciiLowercaseA && character <= Resources.asciiLowercaseF
    || character >= Resources.asciiUppercaseA && character <= Resources.asciiUppercaseF;
}

function isAsciiLetter(character: string): boolean {
  if (character.length !== 1)
    return false;

  return character >= Resources.asciiLowercaseA && character <= Resources.asciiLowercaseZ
    || character >= Resources.asciiUppercaseA && character <= Resources.asciiUppercaseZ;
}

function format(template: string, ...formatArguments: (string | number)[]): string {
  const values: string[] = [];
  let literalStartIndex = 0;
  let templateIndex = 0;

  while (templateIndex < template.length) {
    if (template.charAt(templateIndex) !== Resources.formatOpeningBrace) {
      templateIndex++;
      continue;
    }

    let placeholderIndex = templateIndex + 1;
    let argumentIndex = 0;
    let hasArgumentIndex = false;
    while (placeholderIndex < template.length) {
      const character = template.charAt(placeholderIndex);
      if (!String.isAsciiDigit(character))
        break;

      hasArgumentIndex = true;
      argumentIndex = argumentIndex * Resources.decimalRadix + Number(character);
      placeholderIndex++;
    }

    if (hasArgumentIndex && template.charAt(placeholderIndex) === Resources.formatClosingBrace && argumentIndex < formatArguments.length) {
      if (literalStartIndex < templateIndex)
        values.push(template.substring(literalStartIndex, templateIndex));

      values.push(`${formatArguments[argumentIndex]}`);
      templateIndex = placeholderIndex + 1;
      literalStartIndex = templateIndex;
      continue;
    }

    templateIndex++;
  }

  if (literalStartIndex < template.length)
    values.push(template.substring(literalStartIndex));

  return values.join(String.empty);
}

function isNullOrEmpty(value: string | null | undefined): value is null | undefined | "" {
  return Object.isNull(value) || Object.isUndefined(value) || value === String.empty;
}

function isNullOrWhitespace(value: string | null | undefined): boolean {
  return String.isNullOrEmpty(value) || value.trim() === String.empty;
}

Object.defineProperty(String, nameof<StringConstructor>(t => t.empty), { value: "", writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.format), { value: format, writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.isAsciiDigit), { value: isAsciiDigit, writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.isAsciiHexDigit), { value: isAsciiHexDigit, writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.isAsciiLetter), { value: isAsciiLetter, writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.isNullOrEmpty), { value: isNullOrEmpty, writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.isNullOrWhitespace), { value: isNullOrWhitespace, writable: false, enumerable: false, configurable: false });

export { };
