/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EarlyDocument } from "../../../../src/app/models/layout/early-document";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("EarlyDocument", () => {
  it("holds a document the person opened before the layout loaded and whether it opened as a preview", () => {
    const early = new EarlyDocument(LayoutFixture.plan, true);

    expect([early.tab, early.isPreview]).toEqual([LayoutFixture.plan, true]);
  });
});
