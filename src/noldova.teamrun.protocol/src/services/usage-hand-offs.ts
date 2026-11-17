/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class UsageHandOffs {
  public static validate(teammateIds: readonly string[]): readonly string[] {
    for (const teammateId of teammateIds)
      ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.usageHandOffsField);
    if (new Set(teammateIds).size !== teammateIds.length)
      throw new ArgumentException(Resources.usageHandOffRepeated, Resources.usageHandOffsField);
    return [...teammateIds];
  }

  public static same(first: readonly string[], second: readonly string[]): boolean {
    return first.length === second.length && first.every((t, i) => t === second[i]);
  }
}
