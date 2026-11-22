/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";

import { Chat, Department, MethodName, Organization, OrganizationChat, OrganizationParent } from "@noldova/teamrun.protocol";

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
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => fails ? Promise.reject(new Error("The runtime is gone.")) : [organizationOf("my-organization", "Design").toJson()]);
    const store = new OrganizationStoreService(context, new OrganizationScope());

    await store.reload();
    const said = store.loadError();
    fails = false;
    await store.reload();

    expect([said, store.loadError(), namesOf(store)]).toEqual(["The runtime is gone.", null, "Design"]);
  });

  it("asks the runtime for each change to its organization's departments in its own words, and says nothing went wrong", async () => {
    const asked: string[] = [];
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => []);
    for (const method of [MethodName.DepartmentCreate, MethodName.DepartmentUpdate, MethodName.DepartmentMove, MethodName.DepartmentDelete, MethodName.DepartmentMemberSet])
      context.answer(method, t => {
        asked.push(`${method} ${JSON.stringify(t)}`);
        return null;
      });
    const scope = new OrganizationScope();
    scope.follow(signal("o2"));
    const store = new OrganizationStoreService(context, scope);

    const done = [await store.createDepartment("Design", null), await store.renameDepartment("d1", "Craft"), await store.setLeader("d1", "t1"),
      await store.setLeader("d1", null), await store.moveDepartment("d1", "d2", 1), await store.deleteDepartment("d1"), await store.setMember("t1", "d2"),
      await store.setMember("t1", null)];

    expect([done, store.actionError()]).toEqual([new Array<boolean>(8).fill(true), null]);
    expect(asked).toEqual([
      `${MethodName.DepartmentCreate} {"organizationId":"o2","name":"Design","parent":{"kind":"Person","id":null},"leaderId":null}`,
      `${MethodName.DepartmentUpdate} {"organizationId":"o2","departmentId":"d1","name":"Craft"}`,
      `${MethodName.DepartmentUpdate} {"organizationId":"o2","departmentId":"d1","leaderId":"t1"}`,
      `${MethodName.DepartmentUpdate} {"organizationId":"o2","departmentId":"d1","leaderId":null}`,
      `${MethodName.DepartmentMove} {"organizationId":"o2","departmentId":"d1","parent":{"kind":"Department","id":"d2"},"order":1}`,
      `${MethodName.DepartmentDelete} {"organizationId":"o2","departmentId":"d1"}`,
      `${MethodName.DepartmentMemberSet} {"organizationId":"o2","teammateId":"t1","departmentId":"d2"}`,
      `${MethodName.DepartmentMemberSet} {"organizationId":"o2","teammateId":"t1","departmentId":null}`
    ]);
  });

  it("says why a change failed, in its own words or not, and forgets it on the next change or when cleared", async () => {
    let failure: unknown = new Error("A department can't move under one of its own.");
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [])
      .answer(MethodName.DepartmentMove, () => Promise.reject(failure))
      .answer(MethodName.DepartmentDelete, () => null);
    const store = new OrganizationStoreService(context, new OrganizationScope());

    const moved = await store.moveDepartment("d1", "d2", 0);
    const said = store.actionError();
    failure = "Busy";
    await store.moveDepartment("d1", "d2", 0);
    const plain = store.actionError();
    const deleted = await store.deleteDepartment("d1");
    const afterSuccess = store.actionError();
    await store.moveDepartment("d1", "d2", 0);
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
