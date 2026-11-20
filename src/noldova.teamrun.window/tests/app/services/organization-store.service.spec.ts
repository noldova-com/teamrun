/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Department, DepartmentMember, EventName, MethodName, Organization } from "@noldova/teamrun.protocol";

import { OrganizationStoreService } from "../../../src/app/services/organization-store.service";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("OrganizationStoreService", () => {
  const organizationOf = (...names: readonly string[]): Organization =>
    new Organization(names.map((t, i) => new Department(t, t, null, null, i, "c", "u")), []);
  const namesOf = (store: OrganizationStoreService): string => store.organization().departments.map(t => t.name).join(",");
  let context: FakeWindowPartContext;

  afterEach(() => {
    OrganizationStoreService.release(context);
  });

  it("is one store per window part and starts from the organization the runtime lists", async () => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => organizationOf("Design").toJson());
    const store = OrganizationStoreService.of(context);

    expect(store).toBe(OrganizationStoreService.of(context));
    expect(namesOf(store)).toBe("");
    await Wait.until(() => expect(namesOf(store)).toBe("Design"));
    expect(context.count(MethodName.OrganizationList)).toBe(1);
    expect(store.loadError()).toBeNull();
  });

  it("applies each change event's whole organization", async () => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => Organization.empty.toJson());
    const store = OrganizationStoreService.of(context);
    await Wait.until(() => expect(context.count(MethodName.OrganizationList)).toBe(1));
    const changed = new Organization([new Department("d1", "Design", null, "t1", 0, "c", "u")], [new DepartmentMember("t1", "d1")]);

    context.emit(EventName.OrganizationChanged, changed.toJson());

    expect(store.organization().toJson()).toEqual(changed.toJson());
    expect(store.organization().departmentOf("t1")).toBe("d1");
  });

  it("reads the organization again after a resync rather than trusting the events it may have missed", async () => {
    let listed = organizationOf("Design");
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => listed.toJson());
    const store = OrganizationStoreService.of(context);
    await Wait.until(() => expect(namesOf(store)).toBe("Design"));

    listed = organizationOf("Design", "Web");
    context.emit(EventName.StateResyncRequested, null);

    await Wait.until(() => expect(namesOf(store)).toBe("Design,Web"));
    expect(context.count(MethodName.OrganizationList)).toBe(2);
  });

  it("keeps a change event that arrives while a listing is on its way over the older listing", async () => {
    let answer: () => Promise<JsonValue> = () => Promise.resolve(Organization.empty.toJson());
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => answer());
    const store = OrganizationStoreService.of(context);
    await store.reload();
    const listing = new DeferredResponse();
    answer = () => listing.promise;

    const loading = store.reload();
    context.emit(EventName.OrganizationChanged, organizationOf("Newer").toJson());
    listing.resolve(organizationOf("Older").toJson());
    await loading;

    expect(namesOf(store)).toBe("Newer");
  });

  it("says why the listing failed and clears the failure once a listing succeeds", async () => {
    let fails = true;
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => {
      if (fails)
        throw new Error("The runtime is gone.");
      return organizationOf("Design").toJson();
    });
    const store = OrganizationStoreService.of(context);

    await Wait.until(() => expect(store.loadError()).toBe("The runtime is gone."));
    expect(namesOf(store)).toBe("");
    fails = false;
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(store.loadError()).toBeNull());
    expect(namesOf(store)).toBe("Design");
  });

  it("drops a listing that fails after a newer change, and one that ends after the store is released", async () => {
    let answer: () => Promise<JsonValue> = () => Promise.resolve(Organization.empty.toJson());
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => answer());
    const store = OrganizationStoreService.of(context);
    await store.reload();
    const failing = new DeferredResponse();
    const late = new DeferredResponse();
    answer = () => failing.promise;

    const failed = store.reload();
    context.emit(EventName.OrganizationChanged, organizationOf("Newer").toJson());
    failing.reject(new Error("Too late."));
    await failed;
    answer = () => late.promise;
    const released = store.reload();
    OrganizationStoreService.release(context);
    late.resolve(organizationOf("Released").toJson());
    await released;

    expect(store.loadError()).toBeNull();
    expect(namesOf(store)).toBe("Newer");
    expect(OrganizationStoreService.of(context)).not.toBe(store);
  });
});
