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
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { MethodName, OrganizationParent, TeammatePlacement } from "@noldova/teamrun.protocol";
import { DialogService, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { OrganizationAddTeammateDialogComponent } from "../../../../src/app/components/organization-add-teammate-dialog/organization-add-teammate-dialog.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationScope } from "../../../../src/app/services/organization-scope";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { Resources } from "../../../../src/resources";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { RecordedRequest } from "../../../fixtures/recorded-request.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationAddTeammateDialogComponent", () => {
  const organization = SampleData.organizationOf([], [new TeammatePlacement("alice", OrganizationParent.person, 0),
    new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0)]);
  let context: FakeWindowPartContext;
  let asked: RecordedRequest[];

  const element = (): HTMLElement => {
    const found = [...document.querySelectorAll<HTMLElement>("nol-teamrun-organization-add-teammate-dialog")].at(-1);
    if (Object.isUndefined(found))
      throw new Error("No add teammate dialog is open.");
    return found;
  };
  const one = <T extends HTMLElement>(selector: string, root: ParentNode = element()): T => {
    const found = root.querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`The add teammate dialog shows no ${selector}.`);
    return found;
  };
  const settle = async (): Promise<void> => {
    await TestBed.inject(ApplicationRef).whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await TestBed.inject(ApplicationRef).whenStable();
  };
  const choice = (): HTMLElement => one(".nol-teamrun-add-teammate-choice");
  const save = (): HTMLButtonElement => one<HTMLButtonElement>(".nol-teamrun-save");
  const cancel = (): HTMLButtonElement => one<HTMLButtonElement>(".nol-teamrun-cancel");
  const options = (): string[] => [...document.querySelectorAll<HTMLElement>(".nol-select-option")].map(t => t.textContent?.trim() ?? "");
  const chooseAsync = async (label: string): Promise<string[]> => {
    await userEvent.click(one(".nol-select-button", choice()));
    await Wait.until(() => expect(options().length).toBeGreaterThan(0));
    const offered = options();
    const option = [...document.querySelectorAll<HTMLElement>(".nol-select-option")].find(t => t.textContent?.trim() === label);
    if (Object.isUndefined(option))
      throw new Error(`No option reads ${label}.`);
    await userEvent.click(option);
    await settle();
    return offered;
  };
  const closedAsync = async (): Promise<void> => {
    await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-add-teammate-dialog")).toBeNull());
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-backdrop")).toBeNull());
  };
  const open = async (parent: OrganizationParent, title: string, place: () => Promise<null> = () => Promise.resolve(null)): Promise<void> => {
    context = SampleData.createContext().answer(MethodName.OrganizationList, () => [organization.toJson()]).answer(MethodName.TeammatePlace, t => {
      asked.push(new RecordedRequest(MethodName.TeammatePlace, t));
      return place();
    });
    asked = [];
    const data = new TeammateFixture(context);
    data.teammates.push(data.reviewer);
    TestBed.configureTestingModule({});
    const store = ChatStoreService.of(context);
    const organizations = new OrganizationStoreService(context, new OrganizationScope());
    await Wait.until(() => expect([store.loaded(), store.teammates().length, organizations.organization().placements.length]).toEqual([true, 4, 2]));
    OrganizationAddTeammateDialogComponent.open(TestBed.inject(DialogService), store, organizations, parent, title);
    await Wait.until(() => expect(element().querySelector(".nol-dialog-title")?.textContent?.trim()).toBe(title));
    await settle();
  };

  beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light));

  afterEach(() => {
    AppearanceFixture.reset();
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("offers the team by name, leaving out the teammate it adds under, then New teammate, and adds only once a teammate is chosen", async () => {
    await open(OrganizationParent.teammate("bob"), "Add under Bob");
    const shown = [one(".nol-teamrun-field-label").textContent?.trim(), one(".nol-select-value", choice()).textContent?.trim(), save().disabled,
      save().textContent?.trim(), cancel().textContent?.trim()];

    const offered = await chooseAsync("Offline");
    const chosen = save().disabled;
    save().click();
    await closedAsync();

    expect([shown, offered, chosen]).toEqual([["Teammate", "Choose a teammate", true, "Add", "Cancel"],
      ["Choose a teammate", "Alice", "Code Reviewer", "Offline", "New teammate…"], false]);
    expect(asked).toEqual([new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "offline", parent: { kind: "Teammate", id: "bob" },
      order: Resources.organizationLastOrder })]);
  });

  it("holds the choice, Cancel and Add while a teammate is being placed, and closes once it is", async () => {
    const placing = new DeferredResponse();
    await open(OrganizationParent.person, "Add teammate", async () => {
      await placing.promise;
      return null;
    });
    await chooseAsync("Alice");

    save().click();
    await Wait.until(() => expect(asked).toHaveLength(1));
    await settle();
    const held = [save().disabled, cancel().disabled, one(".nol-select-button", choice()).hasAttribute("disabled") || one(".nol-select-button", choice()).getAttribute("aria-disabled") === "true"];
    placing.resolve(null);
    await closedAsync();

    expect(held).toEqual([true, true, true]);
  });

  it("stays open saying why when the teammate can't be placed, and closes on Cancel or Escape without placing anyone", async () => {
    await open(OrganizationParent.person, "Add teammate", () => Promise.reject(new RuntimeRequestException(FailureCode.Unavailable, "The runtime is busy.")));
    await chooseAsync("Bob");

    save().click();
    await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-add-teammate-dialog .nol-teamrun-dialog-error")?.textContent?.trim()).toBe("The runtime is busy."));
    await settle();
    const failed = [save().disabled, cancel().disabled];
    cancel().click();
    await closedAsync();
    const placed = asked.length;
    OrganizationAddTeammateDialogComponent.open(TestBed.inject(DialogService), ChatStoreService.of(context), new OrganizationStoreService(context, new OrganizationScope()),
      OrganizationParent.person, "Add teammate");
    await Wait.until(() => expect(element().querySelector(".nol-select-value")).not.toBeNull());
    await settle();
    await userEvent.keyboard("{Escape}");
    await closedAsync();

    expect([failed, placed, asked.length]).toEqual([[false, false], 1, 1]);
  });
});
