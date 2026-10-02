/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("DocumentTab", () => {
  it("stays in its group and is available while its document type is registered", () => {
    const registry = LayoutFixture.createRegistry();

    expect(new DocumentTab("notes.note", "plan").isMovable).toBe(false);
    expect(new DocumentTab("notes.note", "plan").isAvailable(registry)).toBe(true);
    expect(new DocumentTab("files.tree").isAvailable(registry)).toBe(false);
  });

  it("writes its name and any instance", () => {
    expect(new DocumentTab("shell.settings").toJson()).toEqual({ document: "shell.settings" });
    expect(new DocumentTab("notes.note", "plan").toJson()).toEqual({ document: "notes.note", instance: "plan" });
  });
});
