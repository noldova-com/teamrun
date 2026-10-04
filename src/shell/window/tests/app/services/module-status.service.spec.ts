/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ModuleStatusService } from "../../../src/app/services/module-status.service";
import { Resources } from "../../../src/resources";
import { ModuleStatusFixture } from "../../fixtures/module-status.fixture";

describe("ModuleStatusService", () => {
  it("holds no module until the runtime reports them", () => {
    const service = TestBed.inject(ModuleStatusService);

    expect([service.modules(), service.notifying(), service.nameOf("notes")]).toEqual([[], [], "notes"]);
  });

  it("keeps the runtime's report in its order and lists the modules with notification kinds, whatever their parts", () => {
    const service = TestBed.inject(ModuleStatusService);
    const reported = [ModuleStatusFixture.create("clock", "Clock"), ModuleStatusFixture.create("reminder", "Reminder", ["reminder.due"]), ModuleStatusFixture.create("notes", "Notes", ["notes.saved"])];

    service.set(reported);

    expect(service.modules()).toEqual(reported);
    expect(service.notifying().map(t => t.id)).toEqual(["reminder", "notes"]);
  });

  it("names an owner: the product for the shell, a reported module by its display name, or else its id", () => {
    const service = TestBed.inject(ModuleStatusService);

    service.set([ModuleStatusFixture.create("reminder", "Reminder", ["reminder.due"])]);

    expect([Resources.shellOwner, "reminder", "weather"].map(t => service.nameOf(t))).toEqual([Resources.productName, "Reminder", "weather"]);
  });
});
