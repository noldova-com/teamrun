/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QueryMatcher } from "@noldova/teamrun-shell-ui";

import { Resources } from "../../resources";
import { CommandMatch } from "./command-match";

export class CommandMatcher {
  public static match(query: string, detail: string, title: string): CommandMatch | null {
    const inTitle = QueryMatcher.find(query, title);
    if (inTitle.length > 0)
      return new CommandMatch(inTitle, []);
    const titleStart = detail.length + Resources.detailSeparator.length;
    const run = QueryMatcher.find(query, `${detail}${Resources.detailSeparator}${title}`);
    if (run.length === 0)
      return null;
    return new CommandMatch(run.filter(t => t >= titleStart).map(t => t - titleStart), run.filter(t => t < detail.length));
  }
}
