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
  interface ObjectConstructor {
    isBigInt(value: unknown): value is bigint;
    isBoolean(value: unknown): value is boolean;
    isFunction(value: unknown): value is Function;
    isNull(value: unknown): value is null;
    isNullOrUndefined(value: unknown): value is null | undefined;
    isNumber(value: unknown): value is number;
    isObject(value: unknown): value is object;
    isString(value: unknown): value is string;
    isSymbol(value: unknown): value is symbol;
    isUndefined(value: unknown): value is undefined;
  }
}

function isBigInt(value: unknown): value is bigint {
  return typeof value === Resources.typeofBigInt;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === Resources.typeofBoolean;
}

function isFunction(value: unknown): value is Function {
  return typeof value === Resources.typeofFunction;
}

function isNull(value: unknown): value is null {
  return value === null;
}

function isNullOrUndefined(value: unknown): value is null | undefined {
  return Object.isNull(value) || Object.isUndefined(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === Resources.typeofNumber;
}

function isObject(value: unknown): value is object {
  return !Object.isNull(value) && (typeof value === Resources.typeofObject || typeof value === Resources.typeofFunction);
}

function isString(value: unknown): value is string {
  return typeof value === Resources.typeofString;
}

function isSymbol(value: unknown): value is symbol {
  return typeof value === Resources.typeofSymbol;
}

function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

// These members must exist before nameof can install the remaining Object extensions. Their names are literal keys because a minifying
// bundler renames the functions, which would make `isString.name` a minified identifier.
Object.defineProperties(Object, {
  isFunction: { value: isFunction, writable: false, enumerable: false, configurable: false },
  isString: { value: isString, writable: false, enumerable: false, configurable: false },
  isUndefined: { value: isUndefined, writable: false, enumerable: false, configurable: false }
});
Object.defineProperty(Object, nameof<ObjectConstructor>(t => t.isBigInt), { value: isBigInt, writable: false, enumerable: false, configurable: false });
Object.defineProperty(Object, nameof<ObjectConstructor>(t => t.isBoolean), { value: isBoolean, writable: false, enumerable: false, configurable: false });
Object.defineProperty(Object, nameof<ObjectConstructor>(t => t.isNull), { value: isNull, writable: false, enumerable: false, configurable: false });
Object.defineProperty(Object, nameof<ObjectConstructor>(t => t.isNullOrUndefined), { value: isNullOrUndefined, writable: false, enumerable: false, configurable: false });
Object.defineProperty(Object, nameof<ObjectConstructor>(t => t.isNumber), { value: isNumber, writable: false, enumerable: false, configurable: false });
Object.defineProperty(Object, nameof<ObjectConstructor>(t => t.isObject), { value: isObject, writable: false, enumerable: false, configurable: false });
Object.defineProperty(Object, nameof<ObjectConstructor>(t => t.isSymbol), { value: isSymbol, writable: false, enumerable: false, configurable: false });

export { };
