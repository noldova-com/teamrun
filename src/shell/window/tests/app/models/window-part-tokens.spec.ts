/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";

describe("WindowPartTokens", () => {
  it("names the context and the page padding a window part's components inject", () => {
    expect(WindowPartTokens.context.toString()).toContain("The window part's context");
    expect(WindowPartTokens.contentPadding.toString()).toContain("The padding of the page a tab shows");
  });
});
