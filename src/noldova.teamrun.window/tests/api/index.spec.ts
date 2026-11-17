/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPart } from "@noldova/desktop.window";
import { windowPart as moduleWindowPart } from "@noldova/teamrun/window";

import { windowPart } from "../../src/api/index";
import { TeamRunWindowPart } from "../../src/app/teamrun-window-part";

describe("the window part's API", () => {
  it("exports TeamRun's window part as windowPart", () => {
    const part: IWindowPart = windowPart;

    expect(part).toBeInstanceOf(TeamRunWindowPart);
    expect(part.moduleId).toBe("teamrun");
  });

  it("is the window part the module package's window entry exports", () => {
    expect(moduleWindowPart).toBe(windowPart);
  });
});
