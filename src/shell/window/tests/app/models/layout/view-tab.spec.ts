/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("ViewTab", () => {
  it("moves between groups and is available while its view is registered", () => {
    const registry = LayoutFixture.createRegistry();

    expect(new ViewTab("files.tree").isMovable).toBe(true);
    expect(new ViewTab("files.tree").isAvailable(registry)).toBe(true);
    expect(new ViewTab("notes.note").isAvailable(registry)).toBe(false);
    expect(new ViewTab("gone.view").isAvailable(registry)).toBe(false);
  });

  it("writes its name and any instance", () => {
    expect(new ViewTab("files.tree").toJson()).toEqual({ view: "files.tree" });
    expect(new ViewTab("terminal.shell", "1").toJson()).toEqual({ view: "terminal.shell", instance: "1" });
  });
});
