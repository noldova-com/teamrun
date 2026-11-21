/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { EventName, MethodName, ProjectsLayoutSaveParams } from "@noldova/teamrun.protocol";

import { ProjectsLayout } from "../../../src/app/models/projects-layout";
import { ProjectsLayoutService } from "../../../src/app/services/projects-layout.service";
import { Resources } from "../../../src/resources";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("ProjectsLayoutService", () => {
  const key = Resources.projectsLayoutStorageKey;
  const kept = (pinned: readonly string[]): JsonValue => new ProjectsLayout([], pinned).toJson();
  let context: FakeWindowPartContext;
  let saves: JsonValue[];

  const contextKeeping = (layout: JsonValue): FakeWindowPartContext => {
    saves = [];
    return new FakeWindowPartContext()
      .answer(MethodName.ProjectsLayoutRead, () => layout)
      .answer(MethodName.ProjectsLayoutSave, t => {
        const saved = ProjectsLayoutSaveParams.fromJson(t).layout;
        saves.push(saved);
        return saved;
      });
  };
  const settle = (): Promise<void> => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const open = async (): Promise<ProjectsLayoutService> => {
    const layout = ProjectsLayoutService.of(context);
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutRead)).toBe(1));
    await settle();
    return layout;
  };

  beforeEach(() => {
    localStorage.removeItem(key);
    context = contextKeeping(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ProjectsLayoutService.release(context);
    localStorage.removeItem(key);
  });

  it("starts empty with no layout kept, and shows the layout the runtime keeps", async () => {
    expect((await open()).layout().toJson()).toEqual(new ProjectsLayout().toJson());
    ProjectsLayoutService.release(context);

    context = contextKeeping(new ProjectsLayout([], ["c1"], ["p2"]).toJson());
    const layout = ProjectsLayoutService.of(context);

    await Wait.until(() => expect(layout.pinnedConversations()).toEqual(["c1"]));
    expect(layout.projectOrder()).toEqual(["p2"]);
    expect(saves).toEqual([]);
  });

  it("is one store per window part", () => {
    expect(ProjectsLayoutService.of(context)).toBe(ProjectsLayoutService.of(context));
    expect(ProjectsLayoutService.of(new FakeWindowPartContext().answer(MethodName.ProjectsLayoutRead, () => null))).not.toBe(ProjectsLayoutService.of(context));
  });

  it("saves each change to the runtime, in order", async () => {
    const layout = await open();

    layout.togglePin("c1");
    layout.togglePin("c2");
    layout.orderPins(["c2", "c1"]);
    layout.orderProjects(["p2", "p1"]);
    layout.orderConversations("p1", ["c3"]);
    layout.toggleProject("p2");

    await Wait.until(() => expect(saves).toHaveLength(6));
    expect(saves.map(t => ProjectsLayout.fromJson(t).pinnedConversations)).toEqual([["c1"], ["c1", "c2"], ["c2", "c1"], ["c2", "c1"], ["c2", "c1"], ["c2", "c1"]]);
    expect(saves.at(-1)).toEqual({ collapsedProjects: ["p2"], pinnedChats: ["c2", "c1"], projectOrder: ["p2", "p1"], chatOrder: { p1: ["c3"] }, collapsedGroups: [] });
    expect(layout.layout().isProjectCollapsed("p2")).toBe(true);
  });

  it("moves a layout an earlier version stored in local storage over once, then removes it", async () => {
    const stored = new ProjectsLayout(["p1"], ["c1"], ["p2", "p1"]).toJson();
    localStorage.setItem(key, JSON.stringify(stored));
    const layout = ProjectsLayoutService.of(context);

    expect(layout.pinnedConversations()).toEqual(["c1"]);
    await Wait.until(() => expect(localStorage.getItem(key)).toBeNull());
    expect(saves).toEqual([stored]);
    ProjectsLayoutService.release(context);

    context = contextKeeping(stored);
    await open();
    expect(saves).toEqual([]);
  });

  it("moves an earlier version's layout with fields it lacked, as the layout it reads", async () => {
    localStorage.setItem(key, JSON.stringify({ pinnedChats: ["c1", 4] }));
    ProjectsLayoutService.of(context);

    await Wait.until(() => expect(localStorage.getItem(key)).toBeNull());
    expect(saves).toEqual([new ProjectsLayout([], ["c1"]).toJson()]);
  });

  it("saves nothing when it opens, even on a layout under the earlier names, so another window's save that lands after its read stays", async () => {
    context = contextKeeping({ collapsedProjects: ["p1"], pinnedConversations: ["c2"], projectOrder: ["p2", "p1"], conversationOrder: { p1: ["c3", "c2"] } });
    const layout = await open();
    const other = { collapsedProjects: [], pinnedChats: ["c2", "c9"], projectOrder: ["p1", "p2"], chatOrder: { p1: ["c3", "c2"] }, collapsedGroups: [] };

    context.emit(EventName.ProjectsLayoutUpdated, other);
    await settle();

    expect(saves).toEqual([]);
    expect(layout.layout().toJson()).toEqual(other);
  });

  it("moves a layout an earlier version stored in local storage under its earlier names to the runtime under the new names", async () => {
    localStorage.setItem(key, JSON.stringify({ pinnedConversations: ["c1"], conversationOrder: { p1: ["c2"] } }));
    const layout = ProjectsLayoutService.of(context);

    expect(layout.pinnedConversations()).toEqual(["c1"]);
    await Wait.until(() => expect(localStorage.getItem(key)).toBeNull());
    expect(saves).toEqual([{ collapsedProjects: [], pinnedChats: ["c1"], projectOrder: [], chatOrder: { p1: ["c2"] }, collapsedGroups: [] }]);
  });

  it("keeps the stored layout when its move can't be saved, to move it at the next start", async () => {
    localStorage.setItem(key, JSON.stringify(kept(["c1"])));
    context = new FakeWindowPartContext().answer(MethodName.ProjectsLayoutRead, () => null).fail(MethodName.ProjectsLayoutSave, "The runtime is gone.");
    const layout = ProjectsLayoutService.of(context);

    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutSave)).toBe(1));
    await settle();

    expect(layout.pinnedConversations()).toEqual(["c1"]);
    expect(localStorage.getItem(key)).toBe(JSON.stringify(kept(["c1"])));
  });

  it.each([["not JSON", "{"], ["an array", "[\"c1\"]"], ["a string", "\"c1\""], ["null", "null"]])("drops a stored layout that is %s, and moves nothing", async (_, text) => {
    localStorage.setItem(key, text);
    const layout = await open();

    expect(localStorage.getItem(key)).toBeNull();
    expect(layout.layout().toJson()).toEqual(new ProjectsLayout().toJson());
    expect(context.count(MethodName.ProjectsLayoutSave)).toBe(0);
  });

  it("shows a stored layout and keeps it when the kept layout can't be read", async () => {
    localStorage.setItem(key, JSON.stringify(kept(["c1"])));
    context = new FakeWindowPartContext().fail(MethodName.ProjectsLayoutRead, "The runtime is gone.");
    const layout = await open();

    expect(layout.pinnedConversations()).toEqual(["c1"]);
    expect(localStorage.getItem(key)).toBe(JSON.stringify(kept(["c1"])));
    expect(context.count(MethodName.ProjectsLayoutSave)).toBe(0);
  });

  it("opens empty when local storage refuses to drop an unreadable stored layout", async () => {
    localStorage.setItem(key, "{");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("The storage is blocked.");
    });

    expect((await open()).layout().toJson()).toEqual(new ProjectsLayout().toJson());
    expect(context.count(MethodName.ProjectsLayoutSave)).toBe(0);
  });

  it("shows the runtime's layout over a stored one, and removes the stored one without saving it", async () => {
    localStorage.setItem(key, JSON.stringify(kept(["c9"])));
    context = contextKeeping(kept(["c1"]));
    const layout = ProjectsLayoutService.of(context);

    await Wait.until(() => expect(layout.pinnedConversations()).toEqual(["c1"]));
    expect(localStorage.getItem(key)).toBeNull();
    expect(saves).toEqual([]);
  });

  it("shows a change made before the kept layout arrives at once, and saves it on the kept layout once it does", async () => {
    const read = new DeferredResponse();
    context = contextKeeping(new ProjectsLayout(["p1"], [], ["p2", "p1"]).toJson());
    context.answer(MethodName.ProjectsLayoutRead, () => read.promise);
    const layout = ProjectsLayoutService.of(context);

    layout.togglePin("c2");
    expect(layout.pinnedConversations()).toEqual(["c2"]);
    await settle();
    expect(saves).toEqual([]);
    read.resolve(new ProjectsLayout(["p1"], ["c1"], ["p2", "p1"]).toJson());

    await Wait.until(() => expect(saves).toEqual([new ProjectsLayout(["p1"], ["c1", "c2"], ["p2", "p1"]).toJson()]));
    expect(layout.layout().toJson()).toEqual(new ProjectsLayout(["p1"], ["c1", "c2"], ["p2", "p1"]).toJson());
  });

  it("shows another window's layout with a change made here while the first read waits, and saves both", async () => {
    const read = new DeferredResponse();
    context.answer(MethodName.ProjectsLayoutRead, () => read.promise);
    const layout = ProjectsLayoutService.of(context);
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutRead)).toBe(1));

    layout.togglePin("c2");
    context.emit(EventName.ProjectsLayoutUpdated, kept(["c1"]));
    expect(layout.pinnedConversations()).toEqual(["c1", "c2"]);
    read.resolve(null);

    await Wait.until(() => expect(saves).toEqual([kept(["c1", "c2"])]));
  });

  it("saves a change made before a failed read on the stored layout", async () => {
    localStorage.setItem(key, JSON.stringify(kept(["c9"])));
    context = contextKeeping(null).fail(MethodName.ProjectsLayoutRead, "The runtime is gone.");
    const layout = ProjectsLayoutService.of(context);

    layout.togglePin("c1");
    await Wait.until(() => expect(saves).toEqual([kept(["c9", "c1"])]));
    expect(layout.pinnedConversations()).toEqual(["c9", "c1"]);
  });

  it("keeps a change for this window when the runtime refuses it", async () => {
    context.fail(MethodName.ProjectsLayoutSave, "The disk is full.");
    const layout = await open();

    layout.togglePin("c1");
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutSave)).toBe(1));
    await settle();

    expect(layout.pinnedConversations()).toEqual(["c1"]);
  });

  it("follows a layout another window keeps, but not while a save of its own is under way", async () => {
    const layout = await open();

    context.emit(EventName.ProjectsLayoutUpdated, kept(["c9"]));
    expect(layout.pinnedConversations()).toEqual(["c9"]);

    const save = new DeferredResponse();
    context.answer(MethodName.ProjectsLayoutSave, () => save.promise);
    layout.togglePin("c1");
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutSave)).toBe(1));
    context.emit(EventName.ProjectsLayoutUpdated, kept(["c8"]));
    expect(layout.pinnedConversations()).toEqual(["c9", "c1"]);

    save.resolve(kept(["c9", "c1"]));
    await Wait.until(() => {
      context.emit(EventName.ProjectsLayoutUpdated, kept(["c7"]));
      expect(layout.pinnedConversations()).toEqual(["c7"]);
    });
  });

  it("shows the layout another window kept during its own save once that save settles, and saves its next change on top of it", async () => {
    const layout = await open();
    const save = new DeferredResponse();
    context.answer(MethodName.ProjectsLayoutSave, () => save.promise);
    layout.togglePin("c1");
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutSave)).toBe(1));
    context.emit(EventName.ProjectsLayoutUpdated, kept(["c1"]));
    context.emit(EventName.ProjectsLayoutUpdated, kept(["c8"]));
    expect(layout.pinnedConversations()).toEqual(["c1"]);

    save.resolve(kept(["c1"]));
    await Wait.until(() => expect(layout.pinnedConversations()).toEqual(["c8"]));
    context.answer(MethodName.ProjectsLayoutSave, t => {
      const saved = ProjectsLayoutSaveParams.fromJson(t).layout;
      saves.push(saved);
      return saved;
    });
    layout.togglePin("c2");

    await Wait.until(() => expect(saves.map(t => ProjectsLayout.fromJson(t).pinnedConversations)).toEqual([["c8", "c2"]]));
  });

  it("applies a change made while a stored layout's move is saved to the move's answer", async () => {
    localStorage.setItem(key, JSON.stringify(kept(["c9"])));
    const move = new DeferredResponse();
    context.answer(MethodName.ProjectsLayoutSave, () => move.promise);
    const layout = ProjectsLayoutService.of(context);
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutSave)).toBe(1));

    layout.togglePin("c1");
    move.resolve(kept(["c8"]));
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutSave)).toBe(2));
    await settle();

    expect(layout.pinnedConversations()).toEqual(["c8", "c1"]);
  });

  it("shows the layout another window kept during a stored layout's move, with a change made meanwhile on top, and saves that", async () => {
    localStorage.setItem(key, JSON.stringify(kept(["c9"])));
    const move = new DeferredResponse();
    context.answer(MethodName.ProjectsLayoutSave, () => move.promise);
    const layout = ProjectsLayoutService.of(context);
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutSave)).toBe(1));

    layout.togglePin("c1");
    context.emit(EventName.ProjectsLayoutUpdated, kept(["c7"]));
    context.answer(MethodName.ProjectsLayoutSave, t => {
      const saved = ProjectsLayoutSaveParams.fromJson(t).layout;
      saves.push(saved);
      return saved;
    });
    move.resolve(kept(["c9"]));

    await Wait.until(() => expect(saves.map(t => ProjectsLayout.fromJson(t).pinnedConversations)).toEqual([["c7", "c1"]]));
    expect(layout.pinnedConversations()).toEqual(["c7", "c1"]);
  });

  it("shows a layout another window keeps while its own read waits, over the read's older answer", async () => {
    const read = new DeferredResponse();
    context.answer(MethodName.ProjectsLayoutRead, () => read.promise);
    const layout = ProjectsLayoutService.of(context);
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutRead)).toBe(1));

    context.emit(EventName.ProjectsLayoutUpdated, kept(["c2"]));
    read.resolve(kept(["c1"]));
    await settle();

    expect(layout.pinnedConversations()).toEqual(["c2"]);
  });

  it("moves a stored layout from one window only, so a second window's move keeps the first window's later change and shows it", async () => {
    localStorage.setItem(key, JSON.stringify(kept(["c9"])));
    let row: JsonValue = null;
    const windowOn = (read: DeferredResponse): FakeWindowPartContext => new FakeWindowPartContext()
      .answer(MethodName.ProjectsLayoutRead, () => read.promise)
      .answer(MethodName.ProjectsLayoutSave, t => {
        const params = ProjectsLayoutSaveParams.fromJson(t);
        if (!params.onlyIfNone || Object.isNull(row))
          row = params.layout;
        return row;
      });
    const [firstRead, secondRead] = [new DeferredResponse(), new DeferredResponse()];
    const [firstContext, secondContext] = [windowOn(firstRead), windowOn(secondRead)];
    const [first, second] = [ProjectsLayoutService.of(firstContext), ProjectsLayoutService.of(secondContext)];

    try {
      firstRead.resolve(null);
      await Wait.until(() => expect(row).toEqual(kept(["c9"])));
      first.togglePin("c1");
      await Wait.until(() => expect(row).toEqual(kept(["c9", "c1"])));
      secondRead.resolve(null);
      await Wait.until(() => expect(secondContext.count(MethodName.ProjectsLayoutSave)).toBe(1));
      await settle();

      expect(row).toEqual(kept(["c9", "c1"]));
      expect(second.pinnedConversations()).toEqual(["c9", "c1"]);
    }
    finally {
      ProjectsLayoutService.release(firstContext);
      ProjectsLayoutService.release(secondContext);
    }
  });

  it("reads the kept layout again when the runtime asks for a resync", async () => {
    const layout = await open();
    context.answer(MethodName.ProjectsLayoutRead, () => kept(["c5"]));

    context.emit(EventName.StateResyncRequested, null);

    await Wait.until(() => expect(layout.pinnedConversations()).toEqual(["c5"]));
  });

  it("keeps a change made while a resync's read waits over the read's answer", async () => {
    const layout = await open();
    const read = new DeferredResponse();
    context.answer(MethodName.ProjectsLayoutRead, () => read.promise);
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutRead)).toBe(2));

    layout.togglePin("c2");
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();
    read.resolve(kept(["c1"]));
    await settle();

    expect(layout.pinnedConversations()).toEqual(["c2"]);
  });

  it("keeps its layout when a resync's read fails", async () => {
    const layout = await open();
    layout.togglePin("c1");
    await Wait.until(() => expect(saves).toHaveLength(1));
    context.fail(MethodName.ProjectsLayoutRead, "The runtime is gone.");

    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(context.count(MethodName.ProjectsLayoutRead)).toBe(2));
    await settle();

    expect(layout.pinnedConversations()).toEqual(["c1"]);
  });

  it("stops following other windows once released", async () => {
    const layout = await open();

    ProjectsLayoutService.release(context);
    context.emit(EventName.ProjectsLayoutUpdated, kept(["c9"]));

    expect(layout.pinnedConversations()).toEqual([]);
    expect(ProjectsLayoutService.of(context)).not.toBe(layout);
  });
});
