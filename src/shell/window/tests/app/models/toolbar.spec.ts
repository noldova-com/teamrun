/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Toolbar } from "../../../src/app/models/toolbar";
import { MenuSection } from "../../../src/app/models/menu-section";

describe("Toolbar", () => {
  it("names a toolbar with its title and the sections it resolved, copying the sections", () => {
    const sections = [new MenuSection("notes.create", [])];
    const toolbar = new Toolbar("notes.main", "Main", sections);
    sections.length = 0;

    expect([toolbar.name, toolbar.title, toolbar.sections.map(t => t.group)]).toEqual(["notes.main", "Main", ["notes.create"]]);
  });
});
