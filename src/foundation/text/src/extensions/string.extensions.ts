/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";

declare global {
  interface StringConstructor {
    isAsciiBinaryDigit(character: string): boolean;
    isAsciiOctalDigit(character: string): boolean;
  }
}

function isAsciiBinaryDigit(character: string): boolean {
  return character === Resources.asciiDigitZero || character === Resources.asciiDigitOne;
}

function isAsciiOctalDigit(character: string): boolean {
  if (character.length !== 1)
    return false;

  return character >= Resources.asciiDigitZero && character <= Resources.asciiDigitSeven;
}

Object.defineProperty(String, nameof<StringConstructor>(t => t.isAsciiBinaryDigit), { value: isAsciiBinaryDigit, writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.isAsciiOctalDigit), { value: isAsciiOctalDigit, writable: false, enumerable: false, configurable: false });

export { };
