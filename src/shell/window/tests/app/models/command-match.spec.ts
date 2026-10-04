/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandMatch } from "../../../src/app/models/command-match";

describe("CommandMatch", () => {
  it("holds the matched characters of a title and of its detail", () => {
    const match = new CommandMatch([0, 1], [4]);

    expect([match.titleMatches, match.detailMatches]).toEqual([[0, 1], [4]]);
  });
});
