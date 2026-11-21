/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { JsonValue } from "@noldova/context.json";
import { EventName, MethodName, OrganizationLayoutSaveParams } from "@noldova/teamrun.protocol";

import { OrganizationCardField } from "../../../src/app/enums/organization-card-field";
import { OrganizationViewMode } from "../../../src/app/enums/organization-view-mode";
import { OrganizationLayout } from "../../../src/app/models/organization-layout";
import { OrganizationLayoutService } from "../../../src/app/services/organization-layout.service";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("OrganizationLayoutService", () => {
  const collapsed = (...ids: string[]): JsonValue => new OrganizationLayout(ids).toJson();
  const tree = OrganizationViewMode.Tree;
  let context: FakeWindowPartContext;
  let saves: JsonValue[];

  const contextKeeping = (read: () => JsonValue | Promise<JsonValue>, save: (layout: JsonValue) => JsonValue | Promise<JsonValue> = t => t): FakeWindowPartContext => {
    saves = [];
    return new FakeWindowPartContext()
      .answer(MethodName.OrganizationLayoutRead, read)
      .answer(MethodName.OrganizationLayoutSave, t => {
        const layout = OrganizationLayoutSaveParams.fromJson(t).layout;
        saves.push(layout);
        return save(layout);
      });
  };
  const settle = (): Promise<void> => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const open = async (): Promise<OrganizationLayoutService> => {
    const layout = OrganizationLayoutService.of(context);
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(1));
    await settle();
    return layout;
  };

  beforeEach(() => {
    context = contextKeeping(() => null);
  });

  afterEach(() => {
    OrganizationLayoutService.release(context);
  });

  it("starts from the defaults with no layout kept, shows the layout kept, and is one service per window", async () => {
    const layout = await open();

    expect([layout.layout().toJson(), OrganizationLayoutService.of(context)]).toEqual([new OrganizationLayout().toJson(), layout]);
    OrganizationLayoutService.release(context);
    context = contextKeeping(() => collapsed("d1"));
    const kept = OrganizationLayoutService.of(context);

    await Wait.until(() => expect(kept.layout().collapsedDepartments).toEqual(["d1"]));
  });

  it("starts from the defaults when the layout can't be read", async () => {
    context = new FakeWindowPartContext().fail(MethodName.OrganizationLayoutRead, "offline");

    expect((await open()).layout().toJson()).toEqual(new OrganizationLayout().toJson());
  });

  it("saves each change in turn, each card's own choice, every card's and their clearing, the view and what Focus shows", async () => {
    const layout = await open();
    layout.toggleDepartment("d1");
    layout.showOnEveryCard(OrganizationCardField.Usage, true);
    layout.showOnCard("t1", OrganizationCardField.Last, true);
    layout.clearCard("t1");
    layout.showOnCard("t2", OrganizationCardField.Model, true);
    layout.clearEveryCard();
    layout.showView(OrganizationViewMode.Focus);
    layout.focusOn("d1");

    await Wait.until(() => expect(saves).toHaveLength(8));
    expect(saves.map(t => OrganizationLayout.fromJson(t)).map(t => [t.collapsedDepartments, t.cardsShow.has(OrganizationCardField.Usage), [...t.cards.keys()], t.view, t.focus]))
      .toEqual([[["d1"], false, [], tree, null], [["d1"], true, [], tree, null], [["d1"], true, ["t1"], tree, null], [["d1"], true, [], tree, null], [["d1"], true, ["t2"], tree, null],
        [["d1"], true, [], tree, null], [["d1"], true, [], OrganizationViewMode.Focus, null], [["d1"], true, [], OrganizationViewMode.Focus, "d1"]]);
    expect([layout.layout().view, layout.layout().focus]).toEqual([OrganizationViewMode.Focus, "d1"]);
  });

  it("holds changes made before the layout is read and saves them over the layout kept", async () => {
    const read = new DeferredResponse();
    context = contextKeeping(() => read.promise);
    const layout = OrganizationLayoutService.of(context);
    layout.toggleDepartment("d2");
    read.resolve(collapsed("d1"));

    await Wait.until(() => expect(saves).toEqual([collapsed("d1", "d2")]));
    expect(layout.layout().collapsedDepartments).toEqual(["d1", "d2"]);
  });

  it("follows another window's save, keeping its own held changes, and the event wins over a read still on its way", async () => {
    const read = new DeferredResponse();
    context = contextKeeping(() => read.promise);
    const layout = OrganizationLayoutService.of(context);
    layout.toggleDepartment("d2");
    context.emit(EventName.OrganizationLayoutUpdated, collapsed("d5"));
    read.resolve(collapsed("d1"));

    await Wait.until(() => expect(saves).toEqual([collapsed("d5", "d2")]));
    await settle();
    context.emit(EventName.OrganizationLayoutUpdated, collapsed("d7"));
    expect(layout.layout().collapsedDepartments).toEqual(["d7"]);
  });

  it("keeps its own state while a save is on its way, and still saves after one fails", async () => {
    const first = new DeferredResponse();
    let calls = 0;
    context = contextKeeping(() => null, t => ++calls === 1 ? first.promise : t);
    const layout = await open();
    layout.toggleDepartment("d1");
    await Wait.until(() => expect(saves).toHaveLength(1));
    context.emit(EventName.OrganizationLayoutUpdated, collapsed("d9"));
    expect(layout.layout().collapsedDepartments).toEqual(["d1"]);
    first.reject(new Error("offline"));
    layout.toggleDepartment("d2");

    await Wait.until(() => expect(saves).toEqual([collapsed("d1"), collapsed("d1", "d2")]));
  });

  it("reads the layout again on a resync unless it was changed, told or saving meanwhile, or none is kept", async () => {
    let kept: JsonValue = collapsed("d1");
    context = contextKeeping(() => kept);
    const layout = await open();
    kept = collapsed("d3");
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(layout.layout().collapsedDepartments).toEqual(["d3"]));

    const late = new DeferredResponse();
    kept = null;
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(3));
    expect(layout.layout().collapsedDepartments).toEqual(["d3"]);

    context.answer(MethodName.OrganizationLayoutRead, () => late.promise);
    context.emit(EventName.StateResyncRequested, null);
    layout.toggleDepartment("d4");
    late.resolve(collapsed("d8"));
    await Wait.until(() => expect(saves).toHaveLength(1));
    expect(layout.layout().collapsedDepartments).toEqual(["d3", "d4"]);

    await settle();
    const quiet = new DeferredResponse();
    context.answer(MethodName.OrganizationLayoutRead, () => quiet.promise);
    context.emit(EventName.StateResyncRequested, null);
    context.emit(EventName.OrganizationLayoutUpdated, collapsed("d6"));
    quiet.resolve(collapsed("d8"));
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(5));
    await settle();
    expect(layout.layout().collapsedDepartments).toEqual(["d6"]);

    const failing = new DeferredResponse();
    context.answer(MethodName.OrganizationLayoutRead, () => failing.promise);
    context.emit(EventName.StateResyncRequested, null);
    failing.reject(new Error("offline"));
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(6));
    expect(layout.layout().collapsedDepartments).toEqual(["d6"]);
  });

  it("stops listening once released, and releases a window it never served", async () => {
    await open();
    OrganizationLayoutService.release(context);
    OrganizationLayoutService.release(new FakeWindowPartContext());

    expect(context.events).toEqual([]);
  });
});
