/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContentPadding } from "../../../src/app/enums/content-padding";

describe("ContentPadding", () => {
  it("names the shell's padding and none, with matching string values", () => {
    expect(Object.entries(ContentPadding)).toEqual([["Default", "Default"], ["None", "None"]]);
  });
});
