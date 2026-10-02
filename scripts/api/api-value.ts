/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModifierFlags } from "typescript/unstable/async";

import ApiException from "./api.exception.ts";

export default class ApiValue {
  public static require<T>(value: T | undefined, description: string): T {
    if (value === undefined)
      throw new ApiException(`The TypeScript API returned no ${description}.`);
    return value;
  }

  public static readModifierFlags(node: object): number {
    return "modifierFlags" in node && typeof node.modifierFlags === "number" ? node.modifierFlags : ModifierFlags.None;
  }
}
