/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { MenuGroup } from "../../../src/app/models/menu-group";
import { MenuItem } from "../../../src/app/models/menu-item";

describe("MenuGroup", () => {
  it("refuses an empty group, a place that is not a qualified name and a dynamic group with items, and makes a dynamic group with none", () => {
    expect(() => new MenuGroup("notes.sorting", "notes.tools", false, [])).toThrowError("A menu group has at least one item.");
    expect(() => new MenuGroup("notes.sorting", "tools", false, [MenuItem.ofCommand("notes.sortBy")])).toThrowError(ArgumentException);
    expect(() => new MenuGroup("notes.recent", "notes.tools", false, [MenuItem.ofCommand("notes.sortBy")], true))
      .toThrowError("A dynamic menu group has no declared items; its owner supplies them.");
    expect([MenuGroup.dynamic("notes.recent", "notes.tools", false).isDynamic, MenuGroup.dynamic("notes.recent", "notes.tools", false).items]).toEqual([true, []]);
  });
});
