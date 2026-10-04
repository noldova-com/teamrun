/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModuleState, ModuleStatus } from "@noldova/teamrun-shell-protocol";

import { ModuleOverview } from "../../../../src/app/models/modules/module-overview";

describe("ModuleOverview", () => {
  const status = (id: string, dependencies: readonly string[] = [], contributions: ReadonlyMap<string, readonly string[]> = new Map()): ModuleStatus =>
    new ModuleStatus(id, id.toUpperCase(), "Used by the tests.", dependencies, contributions, ModuleState.Active, null);
  const tasks = status("tasks");
  const clock = status("clock");
  const notes = status("notes", ["clock", "tasks"]);
  const alarm = status("alarm", ["clock"]);

  it("selects the module an id names, else the first, and nothing when it has no modules", () => {
    const modules = [tasks, clock, notes];
    const overview = new ModuleOverview(modules);
    modules.pop();

    expect([overview.select("clock"), overview.select("weather"), overview.select(null)].map(t => t?.id)).toEqual(["clock", "tasks", "tasks"]);
    expect(overview.modules.length).toBe(3);
    expect(new ModuleOverview([]).select("clock")).toBeNull();
  });

  it("lists a module's dependencies in its declared order and its dependents in module order", () => {
    const overview = new ModuleOverview([tasks, clock, notes, alarm]);

    expect(overview.listDependencies(notes).map(t => t.id)).toEqual(["clock", "tasks"]);
    expect(overview.listDependents(clock).map(t => t.id)).toEqual(["notes", "alarm"]);
    expect([overview.listDependencies(tasks), overview.listDependents(alarm)]).toEqual([[], []]);
  });

  it("groups the contributions a person sees by kind, in a fixed order, with the titles it is given, leaving out other and empty kinds", () => {
    const module = status("clock", [], new Map([
      ["views", ["clock.face"]], ["methods", ["clock.time"]], ["commands", ["clock.tick", "clock.pause"]], ["settings", []], ["notifications", ["clock.alarm"]]
    ]));

    const groups = ModuleOverview.listContributions(module, (kind, name) => kind === "commands" && name === "clock.tick" ? "Tick" : null);

    expect(groups.map(t => [t.kind, t.title, t.rows.map(u => `${u.name}=${u.title}`)])).toEqual([
      ["commands", "Commands", ["clock.tick=Tick", "clock.pause=null"]],
      ["views", "Views", ["clock.face=null"]],
      ["notifications", "Notification kinds", ["clock.alarm=null"]]
    ]);
    expect(ModuleOverview.listContributions(tasks, () => null)).toEqual([]);
  });
});
