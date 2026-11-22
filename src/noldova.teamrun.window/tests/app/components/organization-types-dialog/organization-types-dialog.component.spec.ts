/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { ErrorCode, EventName, MethodName, NodeType, Organization, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { DialogService } from "@noldova/ui.components.angular";
import { userEvent } from "vitest/browser";

import { OrganizationTypesDialogComponent } from "../../../../src/app/components/organization-types-dialog/organization-types-dialog.component";
import { OrganizationScope } from "../../../../src/app/services/organization-scope";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { Resources } from "../../../../src/resources";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationTypesDialogComponent", () => {
  const team = new NodeType("team", "Team", "groups", "teal", SampleData.timestamp, SampleData.timestamp);
  const squad = new NodeType("squad", "Squad", null, null, SampleData.timestamp, SampleData.timestamp);
  const organizationOf = (types: readonly NodeType[]): Organization => new Organization(ProtocolResources.defaultOrganizationId, "My organization", null, 0,
    SampleData.timestamp, SampleData.timestamp, types, [], []);
  let context: FakeWindowPartContext;

  const dialogs = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("nol-dialog")];
  const one = <T extends HTMLElement>(selector: string, root: ParentNode = document): T => {
    const found = root.querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`No dialog shows ${selector}.`);
    return found;
  };
  const top = (): HTMLElement => {
    const found = dialogs().at(-1);
    if (Object.isUndefined(found))
      throw new Error("No dialog is open.");
    return found;
  };
  const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("nol-teamrun-organization-types-dialog .type-row")];
  const names = (): (string | undefined)[] => rows().map(t => t.querySelector(".type-name")?.textContent?.trim());
  const row = (name: string): HTMLElement => {
    const found = rows().find(t => t.querySelector(".type-name")?.textContent?.trim() === name);
    if (Object.isUndefined(found))
      throw new Error(`No type is named ${name}.`);
    return found;
  };
  const open = async (types: readonly NodeType[], configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<OrganizationStoreService> => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organizationOf(types).toJson()]);
    configure(context);
    TestBed.configureTestingModule({});
    const store = new OrganizationStoreService(context, new OrganizationScope());
    await Wait.until(() => expect(store.organization().nodeTypes).toHaveLength(types.length));
    await Wait.until(() => expect(context.count(MethodName.OrganizationList)).toBe(1));
    OrganizationTypesDialogComponent.open(TestBed.inject(DialogService), store);
    await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-types-dialog .nol-teamrun-new-type")).not.toBeNull());
    await Wait.until(() => expect([names(), !Object.isNull(document.querySelector("nol-teamrun-organization-types-dialog .types-empty"))])
      .toEqual([types.map(t => t.name), types.length === 0]));
    return store;
  };

  afterEach(() => {
    OrganizationStoreService.release(context);
  });

  it("lists the organization's types by name, each with its icon in its color, or no icon when it has none, with an edit and a delete button named for it", async () => {
    await open([SampleData.departmentType, team]);
    const icon = (name: string): HTMLElement | null => row(name).querySelector<HTMLElement>(".type-icon .material-symbols-rounded");

    expect([one(".nol-dialog-title", top()).textContent?.trim(), names(), icon("Department"), icon("Team")?.textContent?.trim(), icon("Team")?.style.color,
      one(".type-edit", row("Team")).getAttribute("aria-label"), one(".type-delete", row("Team")).getAttribute("aria-label")])
      .toEqual(["Types", ["Department", "Team"], null, "groups", "var(--nol-swatch-teal)", "Edit Team", "Delete Team"]);
  });

  it("says so when the organization has no types yet", async () => {
    await open([]);

    expect([rows(), one("nol-teamrun-organization-types-dialog .types-empty").textContent?.trim()]).toEqual([[], Resources.organizationNoTypes]);
  });

  it("opens a type's dialog filled with that type from its edit button", async () => {
    await open([SampleData.departmentType, team]);

    one(".type-edit", row("Team")).click();
    await Wait.until(() => expect(dialogs()).toHaveLength(2));
    await Wait.until(() => expect(one<HTMLInputElement>("input.nol-teamrun-type-name", top()).value).toBe("Team"));

    expect([one(".nol-dialog-title", top()).textContent?.trim(), one(".nol-teamrun-type-color [aria-label=Teal]", top()).getAttribute("aria-checked")])
      .toEqual(["Edit type", "true"]);
  });

  it("asks the runtime to delete a type and, when it refuses, keeps the type and shows the runtime's reason", async () => {
    await open([SampleData.departmentType, team], t => t.refuse(MethodName.NodeTypeDelete, ErrorCode.Conflict, "Design still has the type Team."));

    one(".type-delete", row("Team")).click();
    await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-types-dialog .nol-teamrun-dialog-error")?.textContent?.trim())
      .toBe("Design still has the type Team."));

    expect([context.parametersOf(MethodName.NodeTypeDelete), names()]).toEqual([{ organizationId: "my-organization", typeId: "team" }, ["Department", "Team"]]);
  });

  it("adds a row for a type made from New type once the organization changes", async () => {
    await open([SampleData.departmentType], t => t.answer(MethodName.NodeTypeCreate, () => {
      context.emit(EventName.OrganizationChanged, organizationOf([SampleData.departmentType, squad]).toJson());
      return squad.toJson();
    }));

    one("nol-teamrun-organization-types-dialog .nol-teamrun-new-type").click();
    await Wait.until(() => expect(one(".nol-dialog-title", top()).textContent?.trim()).toBe("New type"));
    const title = one(".nol-dialog-title", top()).textContent?.trim();
    await userEvent.type(one("input.nol-teamrun-type-name", top()), "Squad");
    one(".nol-teamrun-save", top()).click();
    await Wait.until(() => expect(dialogs()).toHaveLength(1));
    await Wait.until(() => expect(names()).toEqual(["Department", "Squad"]));

    expect([title, context.parametersOf(MethodName.NodeTypeCreate)]).toEqual(["New type", { organizationId: "my-organization", name: "Squad", icon: null, color: null }]);
  });
});
