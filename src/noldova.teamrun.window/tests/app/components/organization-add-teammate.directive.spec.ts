/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { MethodName, OrganizationParent } from "@noldova/teamrun.protocol";
import { userEvent } from "vitest/browser";

import { OrganizationAddTeammateDirective } from "../../../src/app/components/organization-add-teammate.directive";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { OrganizationStoreService } from "../../../src/app/services/organization-store.service";
import { Resources } from "../../../src/resources";
import type { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { RecordedRequest } from "../../fixtures/recorded-request.fixture";
import { Required } from "../../fixtures/required.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../fixtures/teammate.fixture";
import { Wait } from "../../fixtures/wait.fixture";

@Component({
  imports: [OrganizationAddTeammateDirective],
  template: `<button type="button" class="named" [nolTeamrunAddTeammate]="parent()" [nolTeamrunAddTeammateTitle]="title">Add</button>
    <button type="button" class="plain" [nolTeamrunAddTeammate]="parent()">Add</button>`
})
class AddTeammateHostComponent {
  public readonly parent: WritableSignal<OrganizationParent> = signal(OrganizationParent.department("design"));
  public readonly title: string = "Add to Design";
}

describe("OrganizationAddTeammateDirective", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<AddTeammateHostComponent>;
  let asked: RecordedRequest[];

  const dialog = (): HTMLElement | null => document.querySelector<HTMLElement>("nol-teamrun-organization-add-teammate-dialog");
  const title = (): string | undefined => dialog()?.querySelector(".nol-dialog-title")?.textContent?.trim();
  const openAsync = async (selector: string): Promise<string | undefined> => {
    await userEvent.click(Required.of((fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector)));
    await Wait.until(() => expect(dialog()?.querySelector(".nol-teamrun-add-teammate-choice")).toBeTruthy());
    await fixture.whenStable();
    return title();
  };
  const closeAsync = async (): Promise<void> => {
    dialog()?.querySelector<HTMLElement>(".nol-teamrun-cancel")?.click();
    await Wait.until(() => expect(dialog()).toBeNull());
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-backdrop")).toBeNull());
  };

  beforeEach(async () => {
    asked = [];
    context = SampleData.createContext().answer(MethodName.OrganizationList, () => [SampleData.organizationOf([], []).toJson()])
      .answer(MethodName.TeammatePlace, t => {
        asked.push(new RecordedRequest(MethodName.TeammatePlace, t));
        return null;
      });
    new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(AddTeammateHostComponent);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
  });

  afterEach(() => {
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("opens Add teammate on a click, titled as its host asks or Add teammate, and places the chosen teammate under the parent its host names then", async () => {
    const titles = [await openAsync(".named")];
    await closeAsync();
    titles.push(await openAsync(".plain"));
    await closeAsync();
    fixture.componentInstance.parent.set(OrganizationParent.person);
    await fixture.whenStable();
    await openAsync(".plain");
    await userEvent.click(Required.of(dialog()?.querySelector<HTMLElement>(".nol-teamrun-add-teammate-choice .nol-select-button")));
    await Wait.until(() => expect(document.querySelector(".nol-select-option")).not.toBeNull());
    await userEvent.click(Required.of([...document.querySelectorAll<HTMLElement>(".nol-select-option")].find(t => t.textContent?.trim() === "Bob")));
    await fixture.whenStable();
    dialog()?.querySelector<HTMLElement>(".nol-teamrun-save")?.click();
    await Wait.until(() => expect(dialog()).toBeNull());

    expect([titles, asked]).toEqual([["Add to Design", Resources.organizationAddTeammate], [new RecordedRequest(MethodName.TeammatePlace,
      { organizationId: "my-organization", teammateId: "bob", parent: { kind: "Person", id: null }, order: Resources.organizationLastOrder })]]);
  });
});
