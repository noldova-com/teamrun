/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import { Department, MethodName, NodeType, Organization, OrganizationParent, TeammatePlacement } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { OrganizationUnitEditorComponent } from "../../../../src/app/components/organization-unit-editor/organization-unit-editor.component";
import { OrganizationNode } from "../../../../src/app/models/organization.node";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { PartReadError } from "../../../fixtures/part-read-error.fixture";
import { RecordedRequest } from "../../../fixtures/recorded-request.fixture";
import { Required } from "../../../fixtures/required.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationUnitEditorComponent", () => {
  const team = new NodeType("team", "Team", "groups", "teal", SampleData.timestamp, SampleData.timestamp);
  const organization = new Organization("my-organization", "My organization", null, 0, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType, team],
    [new Department("design", "Design", "team", OrganizationParent.person, "alice", 0, "c", "u"),
      new Department("ops", "Ops", SampleData.departmentType.id, OrganizationParent.person, null, 1, "c", "u")],
    [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("bob", OrganizationParent.department("design"), 1)]);
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationUnitEditorComponent>;
  let asked: RecordedRequest[];
  let closes: number;

  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new PartReadError("The fixture has no element.");
    return native;
  };
  const one = (selector: string): HTMLElement => {
    const found = element().querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new PartReadError(`The unit editor shows no ${selector}.`);
    return found;
  };
  const box = (view: Element): DOMRect => view.getBoundingClientRect();
  const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (departmentId: string, update: () => Promise<null> = () => Promise.resolve(null)): Promise<void> => {
    asked = [];
    closes = 0;
    context = SampleData.createContext().answer(MethodName.OrganizationList, () => [organization.toJson()]).answer(MethodName.DepartmentUpdate, t => {
      asked.push(new RecordedRequest(MethodName.DepartmentUpdate, t));
      return update();
    });
    new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect([store.loaded(), store.teammates().length]).toEqual([true, 3]));
    fixture = TestBed.createComponent(OrganizationUnitEditorComponent);
    fixture.componentRef.setInput("node", Required.of(OrganizationNode.walk(OrganizationNode.treeOf(organization, store.teammates())).find(t => t.department?.id === departmentId)));
    fixture.componentInstance.closed.subscribe(() => closes++);
    element().style.width = "22rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(fixture.debugElement.injector.get(OrganizationStoreService).organization().departments).toHaveLength(2));
    await settle();
  };

  beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light));

  afterEach(() => {
    AppearanceFixture.reset();
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("heads the editor with the unit's type icon and name, names its fields, and closes from Close", async () => {
    await create("design");
    const shown = [one(".head nol-teamrun-organization-type-icon").textContent?.trim(), one(".head .title").textContent?.trim(),
      [...element().querySelectorAll(".nol-teamrun-field-label")].map(t => t.textContent?.trim()), one(".close").getAttribute("aria-label"),
      one(".delete").textContent?.trim()];

    one(".close").click();
    await settle();

    expect([shown, closes]).toEqual([["groups", "Design", ["Name", "Type", "Leader", "Reports to"], "Close", "deleteDelete Team"], 1]);
  });

  it("names Delete by the unit type and heads a unit whose type has no icon with its name alone", async () => {
    await create("ops");

    expect([one(".delete").textContent?.trim(), element().querySelectorAll(".head nol-teamrun-organization-type-icon .material-symbols-rounded").length,
      one(".head .title").textContent?.trim()]).toEqual(["deleteDelete Department", 0, "Ops"]);
  });

  it("puts back the unit's name when the organization refuses the new one", async () => {
    await create("design", () => Promise.reject(new RuntimeRequestException(FailureCode.Unavailable, "The runtime is busy.")));
    const field = one("input.name-field");
    if (!(field instanceof HTMLInputElement))
      throw new PartReadError("The name field is no input.");

    field.value = "Craft";
    field.dispatchEvent(new Event("change"));
    await Wait.until(() => expect(asked).toHaveLength(1));
    await Wait.until(() => expect(field.value).toBe("Design"));

    expect(asked).toEqual([new RecordedRequest(MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", name: "Craft" })]);
  });

  it("lays its head, fields and Delete across the editor inside its space-3 padding, each a step below the one before", async () => {
    await create("design");
    const host = box(element());
    const head = box(one(".head"));
    const close = box(one(".close"));
    const fields = [...element().querySelectorAll(".nol-teamrun-field")].map(box);
    const controls = [one("input.name-field"), one(".type-field .type-choice"), one(".leader-field"), one(".place-field")].map(box);
    const remove = box(one(".delete"));

    AppearanceFixture.expectPixels(head.left, host.left + space(3));
    AppearanceFixture.expectPixels(head.top, host.top + space(3));
    AppearanceFixture.expectPixels(close.right, host.right - space(3));
    for (const view of [...fields, ...controls, remove]) {
      AppearanceFixture.expectPixels(view.left, host.left + space(3));
      AppearanceFixture.expectPixels(view.right, host.right - space(3));
    }
    AppearanceFixture.expectPixels(Required.of(fields.at(0)).top - head.bottom, space(4));
    AppearanceFixture.expectPixels(remove.top - box(one(".nol-teamrun-form")).bottom, space(4));
    expect(fields).toHaveLength(4);
  });
});
