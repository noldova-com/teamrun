/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { ViewType } from "../../../../src/app/models/layout/view-type";

describe("ViewType", () => {
  it("keeps a valid name, its default side and whether it shows by default", () => {
    const type = new ViewType("files.tree", DockSide.Right, true);

    expect([type.name, type.defaultSide, type.isShownByDefault]).toEqual(["files.tree", DockSide.Right, true]);
    expect(() => new ViewType("tree", DockSide.Left, false)).toThrow(ArgumentException);
  });
});
