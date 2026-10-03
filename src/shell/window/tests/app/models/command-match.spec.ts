/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MatchKind } from "../../../src/app/enums/match-kind";
import { CommandMatch } from "../../../src/app/models/command-match";

describe("CommandMatch", () => {
  it("holds how a title matched and which characters", () => {
    const match = new CommandMatch(MatchKind.WordStarts, [0, 6]);

    expect([match.kind, match.matches]).toEqual([MatchKind.WordStarts, [0, 6]]);
  });
});
