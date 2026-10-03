/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import { WindowPartSource } from "../../../src/app/models/window-part-source";

describe("WindowPartSource", () => {
  const part: IWindowPart = { moduleId: "notes", activateAsync: () => Promise.resolve(), deactivateAsync: () => Promise.resolve() };
  const load = (): Promise<IWindowPart> => Promise.resolve(part);

  it("keeps its module's id, name, dependencies, views, commands, bar items and loader, copying the lists", async () => {
    const dependencies = ["tasks"];
    const views = ["notes.list"];
    const commands = ["notes.newNote"];
    const statusBarItems = ["notes.count"];
    const topBarActions = ["notes.compose"];
    const source = new WindowPartSource("notes", "Notes", dependencies, views, commands, statusBarItems, topBarActions, load);
    dependencies.push("clock");
    views.push("notes.outline");
    commands.push("notes.delete");
    statusBarItems.push("notes.sync");
    topBarActions.push("notes.share");

    expect([source.moduleId, source.displayName, source.dependencies, source.viewNames, source.commandNames, source.statusBarItemNames, source.topBarActionNames])
      .toEqual(["notes", "Notes", ["tasks"], ["notes.list"], ["notes.newNote"], ["notes.count"], ["notes.compose"]]);
    expect(await source.load()).toBe(part);
  });

  it("refuses a module id that is not lowercase kebab-case", () => {
    expect(() => new WindowPartSource("Notes", "Notes", [], [], [], [], [], load)).toThrowError(ArgumentException);
  });
});
