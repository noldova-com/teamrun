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
    const inTitle = title.toLowerCase().indexOf(wanted);
    if (inTitle >= 0)
      return new CommandMatch(CommandMatcher.run(inTitle, wanted.length), []);
    const titleStart = category.length + Resources.categorySeparator.length;
    const start = `${category}${Resources.categorySeparator}${title}`.toLowerCase().indexOf(wanted);
    if (start < 0)
      return null;
    const run = CommandMatcher.run(start, wanted.length);
    return new CommandMatch(run.filter(t => t >= titleStart).map(t => t - titleStart), run.filter(t => t < category.length));
  }

  private static run(start: number, length: number): readonly number[] {
    return Array.from({ length }, (_, offset) => start + offset);
  }
}
