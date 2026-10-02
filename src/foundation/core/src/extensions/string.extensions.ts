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
    isNullOrEmpty(value: string | null | undefined): value is null | undefined | "";
    isNullOrWhitespace(value: string | null | undefined): boolean;
  }
}

function isNullOrEmpty(value: string | null | undefined): value is null | undefined | "" {
  return Object.isNull(value) || Object.isUndefined(value) || value === String.empty;
}

function isNullOrWhitespace(value: string | null | undefined): boolean {
  return String.isNullOrEmpty(value) || value.trim() === String.empty;
}

Object.defineProperty(String, nameof<StringConstructor>(t => t.empty), { value: Resources.emptyString, writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.isNullOrEmpty), { value: isNullOrEmpty, writable: false, enumerable: false, configurable: false });
Object.defineProperty(String, nameof<StringConstructor>(t => t.isNullOrWhitespace), { value: isNullOrWhitespace, writable: false, enumerable: false, configurable: false });

export { };
