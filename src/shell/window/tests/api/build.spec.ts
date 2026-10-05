/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MenuDeclarations, WindowPartSource } from "@noldova/teamrun-shell-window/build";

import { MenuDeclarations as SourceMenuDeclarations } from "../../src/app/models/menu-declarations";
import { WindowPartSource as SourceWindowPartSource } from "../../src/app/models/window-part-source";

describe("the window's build entry", () => {
  it("publishes what the build's generated window parts and menus are made of", () => {
    expect([MenuDeclarations, WindowPartSource]).toEqual([SourceMenuDeclarations, SourceWindowPartSource]);
  });
});
