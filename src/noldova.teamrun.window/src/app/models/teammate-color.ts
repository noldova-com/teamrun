/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class TeammateColor {
  public static byCreation(teammates: readonly Teammate[]): ReadonlyMap<string, number> {
    const ordered = teammates.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return new Map(ordered.map((t, index) => [t.id, index % (Resources.teammateColorCount - Resources.defaultTeammateColor) + Resources.defaultTeammateColor + 1]));
  }

  public static of(teammateId: string | null, colors: ReadonlyMap<string, number> = new Map()): number | null {
    if (Object.isNull(teammateId))
      return null;
    const color = colors.get(teammateId);
    if (!Object.isUndefined(color))
      return color;
    let hash = Resources.teammateColorHashOffset;
    for (let index = 0; index < teammateId.length; index++)
      hash = Math.imul(hash ^ teammateId.charCodeAt(index), Resources.teammateColorHashPrime) >>> 0;
    return hash % Resources.teammateColorCount + 1;
  }
}
