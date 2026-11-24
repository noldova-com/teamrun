/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { EventName, MethodName, OrganizationIdParams, OrganizationLayoutSaveParams } from "@noldova/teamrun.protocol";

import { OrganizationCardField } from "../../../src/app/enums/organization-card-field";
import { OrganizationLayout } from "../../../src/app/models/organization-layout";
import { OrganizationLayoutState } from "../../../src/app/services/organization-layout-state";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("OrganizationLayoutState", () => {
  const collapsed = (...ids: string[]): JsonObject => new OrganizationLayout(ids).toJson();
  const updated = (layout: JsonObject, organizationId: string = "my-organization"): JsonValue => new OrganizationLayoutSaveParams(organizationId, layout).toJson();
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
  const open = async (): Promise<OrganizationLayoutState> => {
    const layout = OrganizationLayoutState.of(context, "my-organization");
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(1));
    await settle();
    return layout;
  };

  beforeEach(() => {
    context = contextKeeping(() => null);
  });

  afterEach(() => {
    OrganizationLayoutState.release(context);
  });

  it("starts from the defaults with no layout kept, shows the layout kept, and is one service per window", async () => {
    const layout = await open();

    expect([layout.layout().toJson(), OrganizationLayoutState.of(context, "my-organization")]).toEqual([new OrganizationLayout().toJson(), layout]);
    OrganizationLayoutState.release(context);
    context = contextKeeping(() => collapsed("d1"));
    const kept = OrganizationLayoutState.of(context, "my-organization");

    await Wait.until(() => expect(kept.layout().collapsedDepartments).toEqual(["d1"]));
  });

  it("shows the defaults when the layout can't be read, saving nothing over the layout kept until a later read succeeds, and then saves its changes over it", async () => {
    context = contextKeeping(() => null).fail(MethodName.OrganizationLayoutRead, "offline");
    const layout = await open();
    layout.toggleDepartment("d2");
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(2));
    await settle();

    expect([layout.layout().collapsedDepartments, saves]).toEqual([["d2"], []]);
    context.answer(MethodName.OrganizationLayoutRead, () => collapsed("d1"));
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(saves).toEqual([collapsed("d1", "d2")]));
    expect(layout.layout().collapsedDepartments).toEqual(["d1", "d2"]);
  });

  it("reads the layout again on the first change after a failed read, once while that read is on its way, and saves its changes over what it reads", async () => {
    context = contextKeeping(() => null).fail(MethodName.OrganizationLayoutRead, "offline");
    const layout = await open();
    const again = new DeferredResponse();
    context.answer(MethodName.OrganizationLayoutRead, () => again.promise);
    layout.toggleDepartment("d2");
    layout.toggleDepartment("d3");
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(2));

    expect(saves).toEqual([]);
    again.resolve(collapsed("d1"));
    await Wait.until(() => expect(saves).toEqual([collapsed("d1", "d2", "d3")]));
    expect([layout.layout().collapsedDepartments, context.count(MethodName.OrganizationLayoutRead)]).toEqual([["d1", "d2", "d3"], 2]);
  });

  it("saves each change in turn, each card's own choice, every card's and their clearing", async () => {
    const layout = await open();
    layout.toggleDepartment("d1");
    layout.showOnEveryCard(OrganizationCardField.Usage, true);
    layout.showOnCard("t1", OrganizationCardField.Last, true);
    layout.clearCard("t1");
    layout.showOnCard("t2", OrganizationCardField.Model, true);
    layout.clearEveryCard();

    await Wait.until(() => expect(saves).toHaveLength(6));
    expect(saves.map(t => OrganizationLayout.fromJson(t)).map(t => [t.collapsedDepartments, t.cardsShow.has(OrganizationCardField.Usage), [...t.cards.keys()]]))
      .toEqual([[["d1"], false, []], [["d1"], true, []], [["d1"], true, ["t1"]], [["d1"], true, []], [["d1"], true, ["t2"]], [["d1"], true, []]]);
    expect([layout.layout().collapsedDepartments, layout.layout().cards.size]).toEqual([["d1"], 0]);
  });

  it("holds changes made before the layout is read and saves them over the layout kept", async () => {
    const read = new DeferredResponse();
    context = contextKeeping(() => read.promise);
    const layout = OrganizationLayoutState.of(context, "my-organization");
    layout.toggleDepartment("d2");
    read.resolve(collapsed("d1"));

    await Wait.until(() => expect(saves).toEqual([collapsed("d1", "d2")]));
    expect(layout.layout().collapsedDepartments).toEqual(["d1", "d2"]);
  });

  it("follows another window's save, keeping its own held changes, and the event wins over a read still on its way", async () => {
    const read = new DeferredResponse();
    context = contextKeeping(() => read.promise);
    const layout = OrganizationLayoutState.of(context, "my-organization");
    layout.toggleDepartment("d2");
    context.emit(EventName.OrganizationLayoutUpdated, updated(collapsed("d5")));
    read.resolve(collapsed("d1"));

    await Wait.until(() => expect(saves).toEqual([collapsed("d5", "d2")]));
    await settle();
    context.emit(EventName.OrganizationLayoutUpdated, updated(collapsed("d7")));
    expect(layout.layout().collapsedDepartments).toEqual(["d7"]);
  });

  it("keeps its own state while a save is on its way, and still saves after one fails", async () => {
    const first = new DeferredResponse();
    let calls = 0;
    context = contextKeeping(() => null, t => ++calls === 1 ? first.promise : t);
    const layout = await open();
    layout.toggleDepartment("d1");
    await Wait.until(() => expect(saves).toHaveLength(1));
    context.emit(EventName.OrganizationLayoutUpdated, updated(collapsed("d9")));
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
    context.emit(EventName.OrganizationLayoutUpdated, updated(collapsed("d6")));
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

  it("keeps each organization's layout apart: reads and saves with its id, and follows only its own organization's saves", async () => {
    const asked: string[] = [];
    context = new FakeWindowPartContext()
      .answer(MethodName.OrganizationLayoutRead, t => {
        const organizationId = OrganizationIdParams.fromJson(t).organizationId;
        asked.push(`read ${organizationId}`);
        return organizationId === "o2" ? collapsed("d2") : null;
      })
      .answer(MethodName.OrganizationLayoutSave, t => {
        const params = OrganizationLayoutSaveParams.fromJson(t);
        asked.push(`save ${params.organizationId}`);
        return params.layout;
      });
    const mine = OrganizationLayoutState.of(context, "my-organization");
    const second = OrganizationLayoutState.of(context, "o2");
    await Wait.until(() => expect(second.layout().collapsedDepartments).toEqual(["d2"]));

    mine.toggleDepartment("d1");
    await Wait.until(() => expect(asked).toHaveLength(3));
    context.emit(EventName.OrganizationLayoutUpdated, updated(collapsed("d8"), "o2"));

    expect([mine.layout().collapsedDepartments, second.layout().collapsedDepartments, OrganizationLayoutState.of(context, "o2") === second, asked])
      .toEqual([["d1"], ["d8"], true, ["read my-organization", "read o2", "save my-organization"]]);
  });

  it("stops listening once released, and releases a window it never served", async () => {
    await open();
    OrganizationLayoutState.release(context);
    OrganizationLayoutState.release(new FakeWindowPartContext());

    expect(context.events).toEqual([]);
  });
});
