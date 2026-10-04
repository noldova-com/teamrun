/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";
import { CommandMatch } from "./command-match";

export class CommandMatcher {
  public static match(query: string, detail: string, title: string): CommandMatch | null {
    const wanted = query.trim();
    if (wanted.length === 0)
      return null;
    const pattern = new RegExp(wanted.replace(Resources.regExpSpecialPattern, "\\$&"), "iu");
    const inTitle = pattern.exec(title);
    if (!Object.isNull(inTitle))
      return new CommandMatch(CommandMatcher.run(inTitle.index, inTitle[0].length), []);
    const titleStart = detail.length + Resources.detailSeparator.length;
    const found = pattern.exec(`${detail}${Resources.detailSeparator}${title}`);
    if (Object.isNull(found))
      return null;
    const run = CommandMatcher.run(found.index, found[0].length);
    return new CommandMatch(run.filter(t => t >= titleStart).map(t => t - titleStart), run.filter(t => t < detail.length));
  }

  private static run(start: number, length: number): readonly number[] {
    return Array.from({ length }, (_, offset) => start + offset);
  }
}
