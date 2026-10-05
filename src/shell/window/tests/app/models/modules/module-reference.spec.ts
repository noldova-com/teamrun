/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { ModuleState, ModuleStatus } from "@noldova/teamrun-shell-protocol";

import { ModuleReference } from "../../../../src/app/models/modules/module-reference";

describe("ModuleReference", () => {
  it("holds a referenced module's id and its status, or no status when it is not installed", () => {
    const status = new ModuleStatus("clock", "0.0.1", "Clock", "Tells the time.", [], new Map(), ModuleState.Failed, "Its runtime part failed to activate.");

    expect([new ModuleReference("clock", status).module, new ModuleReference("tasks", null).module, new ModuleReference("tasks", null).id]).toEqual([status, null, "tasks"]);
  });
});
