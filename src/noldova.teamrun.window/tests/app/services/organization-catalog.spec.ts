/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Department, EventName, MethodName, Organization, OrganizationIdParams, OrganizationParent, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { OrganizationCatalog } from "../../../src/app/services/organization-catalog";
import { Resources } from "../../../src/resources";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("OrganizationCatalog", () => {
  const organizationOf = (...names: readonly string[]): Organization =>
    SampleData.organizationOf(names.map((t, i) => new Department(t, t, "department", OrganizationParent.person, null, i, "c", "u")), []);
  const named = (id: string, order: number, createdAt: string): Organization =>
    new Organization(id, id, null, order, createdAt, createdAt, [], []);
  const namesOf = (catalog: OrganizationCatalog): string =>
    catalog.organizations().map(t => `${t.id}:${t.departments.map(u => u.name).join("+")}`).join(",");
  let context: FakeWindowPartContext;

  afterEach(() => {
    OrganizationCatalog.release(context);
  });

  it("is one catalog per window part and starts from the organizations the runtime lists, by order and then creation", async () => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [named("late", 1, "2"), named("b", 0, "3"), named("a", 1, "1")].map(t => t.toJson()));
    const catalog = OrganizationCatalog.of(context);

    expect(catalog).toBe(OrganizationCatalog.of(context));
    expect(namesOf(catalog)).toBe("");
    await Wait.until(() => expect(namesOf(catalog)).toBe("b:,a:,late:"));
    expect([context.count(MethodName.OrganizationList), catalog.loadError()]).toEqual([1, null]);
  });

  it("puts each change event's whole organization in place of the one with its id, adds a new one, and drops a removed one", async () => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organizationOf("Design").toJson(), named("second", 1, "c").toJson()]);
    const catalog = OrganizationCatalog.of(context);
    await Wait.until(() => expect(catalog.organizations().length).toBe(2));

    context.emit(EventName.OrganizationChanged, organizationOf("Design", "Web").toJson());
    context.emit(EventName.OrganizationChanged, named("third", 2, "c").toJson());
    const changed = namesOf(catalog);
    context.emit(EventName.OrganizationRemoved, new OrganizationIdParams("second").toJson());
    context.emit(EventName.OrganizationRemoved, new OrganizationIdParams("never").toJson());

    expect([changed, namesOf(catalog)]).toEqual(["my-organization:Design+Web,second:,third:", "my-organization:Design+Web,third:"]);
  });

  it("closes a removed organization's view, and for the default organization its view under the old instance too", async () => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organizationOf("Design").toJson(), named("second", 1, "c").toJson()]);
    const catalog = OrganizationCatalog.of(context);
    await Wait.until(() => expect(catalog.organizations().length).toBe(2));

    context.emit(EventName.OrganizationRemoved, new OrganizationIdParams("second").toJson());
    const second = [...context.closedDocuments];
    context.emit(EventName.OrganizationRemoved, new OrganizationIdParams(ProtocolResources.defaultOrganizationId).toJson());

    expect(second).toEqual([{ name: Resources.organizationDocumentName, instance: "second" }]);
    expect(context.closedDocuments.slice(1)).toEqual([{ name: Resources.organizationDocumentName, instance: ProtocolResources.defaultOrganizationId },
      { name: Resources.organizationDocumentName, instance: Resources.organizationOldDocumentInstance }]);
  });

  it("reads the organizations again after a resync rather than trusting the events it may have missed", async () => {
    let listed = organizationOf("Design");
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [listed.toJson()]);
    const catalog = OrganizationCatalog.of(context);
    await Wait.until(() => expect(namesOf(catalog)).toBe("my-organization:Design"));

    listed = organizationOf("Design", "Web");
    context.emit(EventName.StateResyncRequested, null);

    await Wait.until(() => expect(namesOf(catalog)).toBe("my-organization:Design+Web"));
    expect(context.count(MethodName.OrganizationList)).toBe(2);
  });

  it("keeps a change event that arrives while a listing is on its way over the older listing", async () => {
    let answer: () => Promise<JsonValue> = () => Promise.resolve([]);
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => answer());
    const catalog = OrganizationCatalog.of(context);
    await catalog.reload();
    const listing = new DeferredResponse();
    answer = () => listing.promise;

    const loading = catalog.reload();
    context.emit(EventName.OrganizationChanged, organizationOf("Newer").toJson());
    listing.resolve([organizationOf("Older").toJson()]);
    await loading;

    expect(namesOf(catalog)).toBe("my-organization:Newer");
  });

  it("keeps the rest of a listing on its way when another organization changes, is added or is removed meanwhile", async () => {
    let answer: () => Promise<JsonValue> = () => Promise.resolve([]);
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => answer());
    const catalog = OrganizationCatalog.of(context);
    await catalog.reload();
    const listing = new DeferredResponse();
    answer = () => listing.promise;

    const loading = catalog.reload();
    context.emit(EventName.OrganizationChanged, named("second", 1, "c").toJson());
    context.emit(EventName.OrganizationChanged, named("third", 2, "c").toJson());
    context.emit(EventName.OrganizationRemoved, new OrganizationIdParams("gone").toJson());
    listing.resolve([organizationOf("Design").toJson(), named("second", 9, "c").toJson(), named("gone", 3, "c").toJson()]);
    await loading;

    expect(namesOf(catalog)).toBe("my-organization:Design,second:,third:");
    expect(catalog.organizations().find(t => t.id === "second")?.order).toBe(1);
  });

  it("says why the listing failed, in its own words or not, and clears the failure once a listing succeeds", async () => {
    let failure: unknown = new Error("The runtime is gone.");
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => Object.isNull(failure) ? [organizationOf("Design").toJson()] : Promise.reject(failure));
    const catalog = OrganizationCatalog.of(context);

    await Wait.until(() => expect(catalog.loadError()).toBe("The runtime is gone."));
    failure = "The runtime stopped.";
    await catalog.reload();
    const plain = catalog.loadError();
    failure = null;
    context.emit(EventName.StateResyncRequested, null);

    await Wait.until(() => expect(catalog.loadError()).toBeNull());
    expect([plain, namesOf(catalog)]).toEqual(["The runtime stopped.", "my-organization:Design"]);
  });

  it("says a listing that isn't a list is one, and keeps the organizations it had", async () => {
    let answer: JsonValue = [organizationOf("Design").toJson()];
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => answer);
    const catalog = OrganizationCatalog.of(context);
    await Wait.until(() => expect(namesOf(catalog)).toBe("my-organization:Design"));
    answer = organizationOf("Web").toJson();

    await catalog.reload();

    expect([catalog.loadError(), namesOf(catalog)]).toEqual([Resources.formatListNotArray("object"), "my-organization:Design"]);
  });

  it("shows why a listing failed after another change landed, keeping that change, and drops a listing that ends after the catalog is released", async () => {
    let answer: () => Promise<JsonValue> = () => Promise.resolve([]);
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => answer());
    const catalog = OrganizationCatalog.of(context);
    await catalog.reload();
    const failing = new DeferredResponse();
    const late = new DeferredResponse();
    answer = () => failing.promise;

    const failed = catalog.reload();
    context.emit(EventName.OrganizationChanged, organizationOf("Newer").toJson());
    failing.reject(new Error("Too late."));
    await failed;
    answer = () => late.promise;
    const released = catalog.reload();
    OrganizationCatalog.release(context);
    late.resolve([organizationOf("Released").toJson()]);
    await released;
    context.emit(EventName.OrganizationChanged, organizationOf("After").toJson());

    expect([catalog.loadError(), namesOf(catalog)]).toEqual(["Too late.", "my-organization:Newer"]);
    expect(OrganizationCatalog.of(context)).not.toBe(catalog);
  });
});
