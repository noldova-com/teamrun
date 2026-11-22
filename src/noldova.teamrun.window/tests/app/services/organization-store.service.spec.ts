/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";

import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { Chat, Department, DepartmentMoveParams, MethodName, Organization, OrganizationChat, OrganizationParent, TeammatePlacement } from "@noldova/teamrun.protocol";

import { OrganizationScope } from "../../../src/app/services/organization-scope";
import { OrganizationStoreService } from "../../../src/app/services/organization-store.service";
import { Resources } from "../../../src/resources";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("OrganizationStoreService", () => {
  const organizationOf = (id: string, ...names: readonly string[]): Organization =>
    new Organization(id, id, null, 0, "c", "u", names.map((t, i) => new Department(t, t, OrganizationParent.person, null, i, "c", "u")), []);
  const namesOf = (store: OrganizationStoreService): string => store.organization().departments.map(t => t.name).join(",");
  let context: FakeWindowPartContext;

  afterEach(() => {
    OrganizationStoreService.release(context);
  });

  it("shows the organization its scope names from the window part's one catalog, and an empty one until it is listed", async () => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organizationOf("my-organization", "Design").toJson(),
      organizationOf("second", "Web").toJson()]);
    const scope = new OrganizationScope();
    const instance = signal("organization");
    scope.follow(instance);
    const store = new OrganizationStoreService(context, scope);
    const other = new OrganizationStoreService(context, new OrganizationScope());
    const before = [store.id(), store.organization().name, namesOf(store)];

    await Wait.until(() => expect(namesOf(store)).toBe("Design"));
    instance.set("second");
    const second = [store.id(), namesOf(store), namesOf(other)];
    instance.set("gone");

    expect([before, second, [store.id(), store.organization().name, namesOf(store)], context.count(MethodName.OrganizationList)])
      .toEqual([["my-organization", Resources.organizationTitle, ""], ["second", "Web", "Design"], ["gone", Resources.organizationTitle, ""], 1]);
  });

  it("reads the catalog again on reload and says why its listing failed", async () => {
    let fails = true;
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => fails ? Promise.reject(new RuntimeRequestException(FailureCode.Disconnected, "The runtime is gone.")) : [organizationOf("my-organization", "Design").toJson()]);
    const store = new OrganizationStoreService(context, new OrganizationScope());

    await store.reload();
    const said = store.loadError();
    fails = false;
    await store.reload();

    expect([said, store.loadError(), namesOf(store)]).toEqual(["The runtime is gone.", null, "Design"]);
  });

  it("asks the runtime for each change to its organization's departments in its own words, and says nothing went wrong", async () => {
    const asked: string[] = [];
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organizationOf("o2", "d1", "d2").toJson()]);
    for (const method of [MethodName.DepartmentCreate, MethodName.DepartmentUpdate, MethodName.DepartmentMove, MethodName.DepartmentDelete, MethodName.DepartmentMemberSet,
      MethodName.TeammatePlace])
      context.answer(method, t => {
        asked.push(`${method} ${JSON.stringify(t)}`);
        return null;
      });
    const scope = new OrganizationScope();
    scope.follow(signal("o2"));
    const store = new OrganizationStoreService(context, scope);
    await Wait.until(() => expect(namesOf(store)).toBe("d1,d2"));

    const done = [await store.createDepartment("Design"), await store.createDepartment("UI", OrganizationParent.teammate("t1"), "t2"),
      await store.renameDepartment("d1", "Craft"), await store.setLeader("d1", "t1"), await store.setLeader("d1", null),
      await store.moveDepartment("d1", OrganizationParent.department("d2")), await store.placeTeammate("t1", OrganizationParent.department("d2")),
      await store.placeTeammate("t1", null), await store.deleteDepartment("d1"), await store.setMember("t1", "d2"), await store.setMember("t1", null)];

    expect([done, store.actionError()]).toEqual([new Array<boolean>(11).fill(true), null]);
    expect(asked).toEqual([
      `${MethodName.DepartmentCreate} {"organizationId":"o2","name":"Design","parent":{"kind":"Person","id":null},"leaderId":null}`,
      `${MethodName.DepartmentCreate} {"organizationId":"o2","name":"UI","parent":{"kind":"Teammate","id":"t1"},"leaderId":"t2"}`,
      `${MethodName.DepartmentUpdate} {"organizationId":"o2","departmentId":"d1","name":"Craft"}`,
      `${MethodName.DepartmentUpdate} {"organizationId":"o2","departmentId":"d1","leaderId":"t1"}`,
      `${MethodName.DepartmentUpdate} {"organizationId":"o2","departmentId":"d1","leaderId":null}`,
      `${MethodName.DepartmentMove} {"organizationId":"o2","departmentId":"d1","parent":{"kind":"Department","id":"d2"},"order":9007199254740991}`,
      `${MethodName.TeammatePlace} {"organizationId":"o2","teammateId":"t1","parent":{"kind":"Department","id":"d2"},"order":9007199254740991}`,
      `${MethodName.TeammatePlace} {"organizationId":"o2","teammateId":"t1","parent":null,"order":9007199254740991}`,
      `${MethodName.DepartmentDelete} {"organizationId":"o2","departmentId":"d1"}`,
      `${MethodName.DepartmentMemberSet} {"organizationId":"o2","teammateId":"t1","departmentId":"d2"}`,
      `${MethodName.DepartmentMemberSet} {"organizationId":"o2","teammateId":"t1","departmentId":null}`
    ]);
  });

  it("sends each change only once the one before it is answered, so changes made within one round trip land in the order they were made", async () => {
    const asked: string[] = [];
    let release: () => void = () => undefined;
    const held = new Promise<null>(resolve => release = () => resolve(null));
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organizationOf("my-organization", "d1", "d2", "d3").toJson()])
      .answer(MethodName.DepartmentMove, t => {
        asked.push(DepartmentMoveParams.fromJson(t).departmentId);
        return asked.length === 1 ? held : null;
      });
    const store = new OrganizationStoreService(context, new OrganizationScope());
    await Wait.until(() => expect(namesOf(store)).toBe("d1,d2,d3"));

    const first = store.moveDepartment("d1", OrganizationParent.department("d3"));
    const second = store.moveDepartment("d2", OrganizationParent.department("d3"));
    await Wait.until(() => expect(asked.length).toBe(1));
    const whileHeld = asked.length;
    release();
    const done = [await first, await second];

    expect([whileHeld, done, asked]).toEqual([1, [true, true], ["d1", "d2"]]);
  });

  it("refuses a move under itself or under a node it doesn't know before sending it, in the server's words", async () => {
    const organization = new Organization("my-organization", "my-organization", null, 0, "c", "u", [new Department("d1", "d1", OrganizationParent.person, null, 0, "c", "u"),
      new Department("d2", "d2", OrganizationParent.department("d1"), null, 0, "c", "u")], [new TeammatePlacement("t1", OrganizationParent.department("d2"), 0)]);
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organization.toJson()]);
    const store = new OrganizationStoreService(context, new OrganizationScope());
    await Wait.until(() => expect(namesOf(store)).toBe("d1,d2"));

    const refused = [await store.moveDepartment("d1", OrganizationParent.department("d2")), store.actionError(),
      await store.placeTeammate("t1", OrganizationParent.teammate("t1")), store.actionError(),
      await store.placeTeammate("t1", OrganizationParent.department("gone")), store.actionError()];

    expect([refused, context.count(MethodName.DepartmentMove), context.count(MethodName.TeammatePlace)]).toEqual([[false, organization.moveError(
      OrganizationParent.department("d1"), OrganizationParent.department("d2")), false, organization.moveError(OrganizationParent.teammate("t1"),
      OrganizationParent.teammate("t1")), false, organization.moveError(OrganizationParent.teammate("t1"), OrganizationParent.department("gone"))], 0, 0]);
  });

  it("says why a change failed, in its own words or not, and forgets it on the next change or when cleared", async () => {
    let failure: unknown = new Error("A department can't move under one of its own.");
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organizationOf("my-organization", "d1", "d2").toJson()])
      .answer(MethodName.DepartmentMove, () => Promise.reject(failure))
      .answer(MethodName.DepartmentDelete, () => null);
    const store = new OrganizationStoreService(context, new OrganizationScope());
    await Wait.until(() => expect(namesOf(store)).toBe("d1,d2"));

    const moved = await store.moveDepartment("d1", OrganizationParent.department("d2"));
    const said = store.actionError();
    failure = "Busy";
    await store.moveDepartment("d1", OrganizationParent.department("d2"));
    const plain = store.actionError();
    const deleted = await store.deleteDepartment("d1");
    const afterSuccess = store.actionError();
    await store.moveDepartment("d1", OrganizationParent.department("d2"));
    store.clearActionError();
    const cleared = store.actionError();

    expect([moved, said, plain, deleted, afterSuccess, cleared])
      .toEqual([false, "A department can't move under one of its own.", "Busy", true, null, null]);
  });

  it("opens a teammate's Organization chat in its organization, or says why it couldn't", async () => {
    const chat = new Chat("c1", null, "Organization · Grok", "t", "t", false, null, null, false, null, false, [], false, false, null,
      new OrganizationChat("my-organization", "grok"));
    const asked: string[] = [];
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [])
      .answer(MethodName.OrganizationChatOpen, t => {
        const opening = OrganizationChat.fromJson(t);
        asked.push(`${opening.organizationId}/${opening.teammateId}`);
        return opening.teammateId === "grok" ? chat.toJson() : Promise.reject(new Error("There is no teammate gone."));
      });
    const store = new OrganizationStoreService(context, new OrganizationScope());

    const missing = await store.openOrganizationChat("gone");
    const said = store.actionError();
    const opened = await store.openOrganizationChat("grok");

    expect([missing, said, opened?.toJson(), store.actionError(), asked])
      .toEqual([null, "There is no teammate gone.", chat.toJson(), null, ["my-organization/gone", "my-organization/grok"]]);
  });
});
