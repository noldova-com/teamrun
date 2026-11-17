/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources";

export class TeammateColor {
  public static of(teammateId: string | null): number | null {
    if (Object.isNull(teammateId))
      return null;
    let hash = Resources.teammateColorHashOffset;
    for (let index = 0; index < teammateId.length; index++)
      hash = Math.imul(hash ^ teammateId.charCodeAt(index), Resources.teammateColorHashPrime) >>> 0;
    return hash % Resources.teammateColorCount + 1;
  }
}
