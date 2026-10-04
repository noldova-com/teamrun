/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { CommandMatch } from "./command-match";

export class CommandMatcher {
  public static match(query: string, category: string, title: string): CommandMatch | null {
    const wanted = query.trim().toLowerCase();
    const start = `${title}${Resources.categorySeparator}${category}`.toLowerCase().indexOf(wanted);
    if (start < 0)
      return null;
    const categoryStart = title.length + Resources.categorySeparator.length;
    const run = Array.from({ length: wanted.length }, (_, offset) => start + offset);
    return new CommandMatch(run.filter(t => t < title.length), run.filter(t => t >= categoryStart).map(t => t - categoryStart));
  }
}
