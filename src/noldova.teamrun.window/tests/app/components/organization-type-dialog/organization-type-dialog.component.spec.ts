/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { MethodName, NodeType, Organization, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { DialogService, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { OrganizationTypeDialogComponent } from "../../../../src/app/components/organization-type-dialog/organization-type-dialog.component";
import { OrganizationScope } from "../../../../src/app/services/organization-scope";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationTypeDialogComponent", () => {
  const team = new NodeType("team", "Team", "groups", "teal", SampleData.timestamp, SampleData.timestamp);
  const squad = new NodeType("squad", "Squad", "apartment", "#1a2b3c", SampleData.timestamp, SampleData.timestamp);
  const plain = new NodeType("plain", "Plain", null, null, SampleData.timestamp, SampleData.timestamp);
  const organization = new Organization(ProtocolResources.defaultOrganizationId, "My organization", null, 0, SampleData.timestamp, SampleData.timestamp,
    [SampleData.departmentType, team, plain], [], []);
  let context: FakeWindowPartContext;
  let store: OrganizationStoreService;
  let created: string[];
  let closes: number;

  const element = (): HTMLElement => {
    const found = [...document.querySelectorAll<HTMLElement>("nol-teamrun-organization-type-dialog")].at(-1);
    if (Object.isUndefined(found))
      throw new Error("No type dialog is open.");
    return found;
  };
  const one = <T extends HTMLElement>(selector: string, root: ParentNode = element()): T => {
    const found = root.querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`The type dialog shows no ${selector}.`);
    return found;
  };
  const settle = async (): Promise<void> => {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await TestBed.inject(ApplicationRef).whenStable();
  };
  const save = (): HTMLButtonElement => one<HTMLButtonElement>(".nol-teamrun-save");
  const nameField = (): HTMLInputElement => one<HTMLInputElement>("input.nol-teamrun-type-name");
  const swatch = (label: string): HTMLElement => one(`.nol-teamrun-type-color [role=radio][aria-label="${label}"]`);
  const rename = async (text: string): Promise<void> => {
    await userEvent.clear(nameField());
    if (text.length > 0)
      await userEvent.type(nameField(), text);
    await settle();
  };
  const create = async (type: NodeType | null, configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = new FakeWindowPartContext().answer(MethodName.OrganizationList, () => [organization.toJson()]);
    configure(context);
    TestBed.configureTestingModule({});
    store = new OrganizationStoreService(context, new OrganizationScope());
    await Wait.until(() => expect(store.organization().nodeTypes.map(t => t.id)).toEqual(["department", "team", "plain"]));
    created = [];
    closes = 0;
    const dialog = OrganizationTypeDialogComponent.open(TestBed.inject(DialogService), store, type);
    dialog?.created.subscribe(t => created.push(t.id));
    dialog?.closed.subscribe(() => closes++);
    await Wait.until(() => expect(element().querySelector(".nol-dialog-title")?.textContent?.trim()).toBe(Object.isNull(type) ? "New type" : "Edit type"));
    await settle();
  };

  beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light));

  afterEach(() => {
    AppearanceFixture.reset();
    OrganizationStoreService.release(context);
  });

  it("creates a type from its name, an icon found by search and a custom color, sending the color in lower case, then hands the type back and closes", async () => {
    await create(null, t => t.answer(MethodName.NodeTypeCreate, () => squad.toJson()));
    const title = one(".nol-dialog-title").textContent?.trim();
    const blank = save().disabled;

    await rename("Squad");
    await userEvent.type(one(".nol-teamrun-type-icon .nol-icon-chooser-search"), "apartment");
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-type-icon [role=option][aria-label=apartment]")).not.toBeNull());
    await userEvent.click(one(".nol-teamrun-type-icon [role=option][aria-label=apartment]"));
    await userEvent.click(swatch("Custom color"));
    await Wait.until(() => expect(document.querySelector(".nol-color-picker-hex-field")).not.toBeNull());
    const hex = one<HTMLInputElement>(".nol-color-picker-hex-field", document);
    await userEvent.clear(hex);
    await userEvent.type(hex, "#1A2B3C");
    await settle();
    save().click();
    await Wait.until(() => expect(closes).toBe(1));

    expect([title, blank, context.parametersOf(MethodName.NodeTypeCreate), created]).toEqual(["New type", true,
      { organizationId: "my-organization", name: "Squad", icon: "apartment", color: "#1a2b3c" }, ["squad"]]);
  });

  it("starts from the type it edits and sends only the fields that changed", async () => {
    await create(team, t => t.answer(MethodName.NodeTypeUpdate, () => null));
    const shown = [one(".nol-dialog-title").textContent?.trim(), nameField().value, swatch("Teal").getAttribute("aria-checked")];

    await rename("Squad");
    await userEvent.click(swatch("Red"));
    await settle();
    save().click();
    await Wait.until(() => expect(closes).toBe(1));

    expect([shown, context.parametersOf(MethodName.NodeTypeUpdate), created]).toEqual([["Edit type", "Team", "true"],
      { organizationId: "my-organization", typeId: "team", name: "Squad", color: "red" }, []]);
  });

  it("sends only the icon given to a type with no icon or color, and stays open saying why when the runtime refuses it", async () => {
    await create(plain, t => t.fail(MethodName.NodeTypeUpdate, "The runtime is busy."));

    await userEvent.type(one(".nol-teamrun-type-icon .nol-icon-chooser-search"), "groups");
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-type-icon [role=option][aria-label=groups]")).not.toBeNull());
    await userEvent.click(one(".nol-teamrun-type-icon [role=option][aria-label=groups]"));
    await settle();
    save().click();
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-dialog-error")?.textContent?.trim()).toBe("The runtime is busy."));
    await Wait.until(() => expect(save().disabled).toBe(false));
    await settle();

    expect([context.parametersOf(MethodName.NodeTypeUpdate), closes]).toEqual([{ organizationId: "my-organization", typeId: "plain", icon: "groups" }, 0]);
  });

  it("closes without asking the runtime when nothing about the type changed", async () => {
    await create(team);

    await rename("Squad");
    await rename("Team");
    save().click();
    await Wait.until(() => expect(closes).toBe(1));

    expect([context.count(MethodName.NodeTypeUpdate), context.count(MethodName.NodeTypeCreate), created]).toEqual([0, 0, []]);
  });

  it("refuses a blank name, and stays open saying why when the type can't be made", async () => {
    await create(null, t => t.fail(MethodName.NodeTypeCreate, "The runtime is busy."));

    await rename("   ");
    const blank = save().disabled;
    await rename("Squad");
    save().click();
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-dialog-error")?.textContent?.trim()).toBe("The runtime is busy."));
    await settle();

    expect([blank, closes, created, save().disabled, nameField().value, context.count(MethodName.NodeTypeCreate)]).toEqual([true, 0, [], false, "Squad", 1]);
  });
});
