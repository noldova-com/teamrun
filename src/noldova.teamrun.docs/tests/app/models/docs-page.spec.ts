/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocsGroup } from "../../../src/app/enums/docs-group";
import { DocsPage } from "../../../src/app/models/docs-page";

describe("DocsPage", () => {
  it("links to its path from the site's root", () => {
    expect(new DocsPage("Install", "install", DocsGroup.Start, "install", String()).link).toBe("/install");
    expect(new DocsPage("TeamRun", String(), DocsGroup.Start, "home", String()).link).toBe("/");
  });
});
