/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocsGroup } from "../../../src/app/enums/docs-group";
import { DocsPage } from "../../../src/app/models/docs-page";
import { DocsSearchEntry } from "../../../src/app/models/docs-search-entry";

describe("DocsSearchEntry", () => {
  const entry = new DocsSearchEntry(new DocsPage("Page", "page", DocsGroup.Start, "page", String()), ["Alpha", "BetaGamma"]);

  it("keeps its terms in lower case", () => {
    expect(entry.terms).toEqual(["alpha", "betagamma"]);
  });

  it("matches a lower-case query found inside a term", () => {
    expect(entry.matches("gam")).toBe(true);
    expect(entry.matches("delta")).toBe(false);
  });
});
