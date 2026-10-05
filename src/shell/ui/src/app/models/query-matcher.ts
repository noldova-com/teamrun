/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";

export class QueryMatcher {
  public static find(query: string, text: string): readonly number[] {
    const wanted = query.trim();
    if (wanted.length === 0)
      return [];
    const found = new RegExp(wanted.replace(Resources.regExpSpecialPattern, "\\$&"), "iu").exec(text);
    if (Object.isNull(found))
      return [];
    return Array.from({ length: found[0].length }, (_, offset) => found.index + offset);
  }
}
