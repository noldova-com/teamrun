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
  const part: IWindowPart = { moduleId: "notes", activateAsync: () => Promise.resolve(), reconnectAsync: () => Promise.resolve(false), deactivateAsync: () => Promise.resolve() };
  const load = (): Promise<IWindowPart> => Promise.resolve(part);

  it("keeps its module's id, name, dependencies, views, documents, commands, bar items, notification kinds and loader, copying the lists", async () => {
    const dependencies = ["tasks"];
    const views = ["notes.list"];
    const documents = ["notes.note"];
    const commands = ["notes.newNote"];
    const statusBarItems = ["notes.count"];
    const topBarActions = ["notes.compose"];
    const notifications = ["notes.saved"];
    const source = new WindowPartSource("notes", dependencies, views, documents, commands, statusBarItems, topBarActions, notifications, load);
    dependencies.push("clock");
    views.push("notes.outline");
    documents.push("notes.page");
    commands.push("notes.delete");
    statusBarItems.push("notes.sync");
    topBarActions.push("notes.share");
    notifications.push("notes.deleted");

    expect([source.moduleId, source.dependencies, source.viewNames, source.documentNames, source.commandNames, source.statusBarItemNames, source.topBarActionNames, source.notificationKinds])
      .toEqual(["notes", ["tasks"], ["notes.list"], ["notes.note"], ["notes.newNote"], ["notes.count"], ["notes.compose"], ["notes.saved"]]);
    expect(await source.load()).toBe(part);
  });

  it("refuses a module id that is not lowercase kebab-case", () => {
    expect(() => new WindowPartSource("Notes", [], [], [], [], [], [], [], load)).toThrowError(ArgumentException);
  });
});
