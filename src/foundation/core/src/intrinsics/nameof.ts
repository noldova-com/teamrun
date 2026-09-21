/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import type { NameofSelector } from "../types/nameof-selector.js";

export function nameof<T>(name: keyof T & string): string;
export function nameof<T>(selector: (t: NameofSelector<T>) => keyof T & string): string;
export function nameof<T>(value: (keyof T & string) | ((t: NameofSelector<T>) => keyof T & string)): string {
  if (Object.isString(value))
    return value;

  if (!Object.isFunction(value))
    throw new TypeError(Resources.nameofArgumentInvalid);

  let memberName: string | undefined;
  const selector = new Proxy({}, {
    get: (_target, property): string => {
      if (!Object.isString(property) || !Object.isUndefined(memberName))
        throw new TypeError(Resources.nameofArgumentInvalid);

      memberName = property;
      return property;
    },
  });

  let result: unknown;
  try {
    result = Reflect.apply(value, undefined, [selector]);
  }
  catch (error) {
    throw new TypeError(Resources.nameofArgumentInvalid, { cause: error });
  }

  if (Object.isUndefined(memberName) || result !== memberName)
    throw new TypeError(Resources.nameofArgumentInvalid);

  return memberName;
}
