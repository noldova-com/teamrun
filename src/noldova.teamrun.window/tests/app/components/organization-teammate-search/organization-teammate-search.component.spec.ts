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
import { Department, MethodName, OrganizationParent, TeammatePlacement } from "@noldova/teamrun.protocol";
import { OverlayAlignment, OverlaySide, PopoverOpening, PopoverTriggerDirective, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { OrganizationTeammateSearchComponent } from "../../../../src/app/components/organization-teammate-search/organization-teammate-search.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { Resources } from "../../../../src/resources";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { PartReadError } from "../../../fixtures/part-read-error.fixture";
import { PartReads } from "../../../fixtures/part-reads.fixture";
import { RecordedRequest } from "../../../fixtures/recorded-request.fixture";
import { Required } from "../../../fixtures/required.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

@Component({
  imports: [OrganizationTeammateSearchComponent, PopoverTriggerDirective],
  providers: [ChatStoreService.provider, OrganizationStoreService.provider],
  template: `<button #search="nolPopoverTrigger" type="button" class="add" [nolPopoverTrigger]="teammateSearch" [nolPopoverOpenOn]="opening"
      [nolPopoverSide]="side" [nolPopoverAlignment]="alignment">Add</button>
    <ng-template #teammateSearch>
      <nol-teamrun-organization-teammate-search label="Add teammate" [parent]="parent()" (done)="search.close()" />
    </ng-template>`
})
class TeammateSearchHostComponent {
  protected readonly opening: PopoverOpening = PopoverOpening.Click;
  protected readonly side: OverlaySide = OverlaySide.below;
  protected readonly alignment: OverlayAlignment = OverlayAlignment.Start;

  public readonly parent: WritableSignal<OrganizationParent> = signal(OrganizationParent.department("design"));
}

describe("OrganizationTeammateSearchComponent", () => {
  const organization = SampleData.organizationOf([new Department("design", "Design", SampleData.departmentType.id, OrganizationParent.person, null, 0, "c", "u")],
    [new TeammatePlacement("alice", OrganizationParent.person, 0),
    new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0)]);
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<TeammateSearchHostComponent>;
  let asked: RecordedRequest[];

  const search = (): HTMLElement | null => document.querySelector<HTMLElement>("nol-teamrun-organization-teammate-search");
  const one = (selector: string, root: ParentNode = document): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new PartReadError(`The page shows no ${selector}.`);
    return found;
  };
  const texts = (selector: string): string[] => [...document.querySelectorAll<HTMLElement>(`nol-teamrun-organization-teammate-search ${selector}`)]
    .map(t => t.textContent?.trim() ?? "");
  const field = (): HTMLElement => one("nol-teamrun-organization-teammate-search .nol-quick-input-field");
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const openAsync = async (query: string): Promise<string[]> => {
    await userEvent.click(one(".add", PartReads.elementOf(fixture.nativeElement)));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-teammate-search .nol-quick-input-field")).not.toBeNull());
    if (query.length > 0)
      await userEvent.type(field(), query);
    await settle();
    return texts(".nol-quick-input-option .nol-quick-input-title");
  };
  const pickAsync = async (name: string): Promise<void> => {
    const option = [...document.querySelectorAll<HTMLElement>("nol-teamrun-organization-teammate-search .nol-quick-input-option")]
      .find(t => t.querySelector(".nol-quick-input-title")?.textContent?.trim() === name);
    if (Object.isUndefined(option))
      throw new PartReadError(`The search offers no ${name}.`);
    await userEvent.click(option);
    await settle();
  };
  const closedAsync = async (): Promise<void> => {
    await Wait.until(() => expect(search()).toBeNull());
  };

  beforeEach(async () => {
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
    asked = [];
    context = SampleData.createContext().answer(MethodName.OrganizationList, () => [organization.toJson()]).answer(MethodName.TeammatePlace, t => {
      asked.push(new RecordedRequest(MethodName.TeammatePlace, t));
      return null;
    });
    new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(TeammateSearchHostComponent);
    fixture.autoDetectChanges();
    await Wait.until(() => expect([ChatStoreService.of(context).loaded(), ChatStoreService.of(context).teammates().length]).toEqual([true, 3]));
    await settle();
  });

  afterEach(() => {
    AppearanceFixture.reset();
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("lists no one until a name is typed, then the matches and a new teammate, and places the chosen one under its parent, closing", async () => {
    const before = await openAsync("");
    const hint = texts(".nol-quick-input-empty");
    await userEvent.type(field(), "zz");
    await settle();
    const none = [texts(".nol-quick-input-option .nol-quick-input-title"), texts(".nol-quick-input-option .nol-quick-input-detail")];
    await userEvent.clear(field());
    await userEvent.type(field(), "al");
    await settle();
    const found = texts(".nol-quick-input-option .nol-quick-input-title");
    await pickAsync("Alice");
    await closedAsync();

    expect([before, hint, none, found, asked]).toEqual([[], ["Type a teammate's name."], [["New teammate…"], ["zz"]], ["Alice", "New teammate…"],
      [new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "alice", parent: { kind: "Department", id: "design" },
        order: Resources.organizationLastOrder })]]);
  });

  it("leaves out the teammate it adds under, in a popover 22rem wide whose field has no card of its own, stays open saying why when the organization refuses one, below the field, and closes on Escape", async () => {
    fixture.componentInstance.parent.set(OrganizationParent.teammate("bob"));
    await settle();

    const offered = await openAsync("o");
    await userEvent.clear(field());
    await userEvent.type(field(), "al");
    await settle();
    await pickAsync("Alice");
    await Wait.until(() => expect(texts(".error")).toEqual(["A teammate or department can't be under itself."]));
    const popover = one("nol-teamrun-organization-teammate-search");
    const frame = getComputedStyle(popover);
    const input = one("nol-teamrun-organization-teammate-search nol-quick-input").getBoundingClientRect();
    const error = one("nol-teamrun-organization-teammate-search .error").getBoundingClientRect();
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const look = getComputedStyle(one("nol-teamrun-organization-teammate-search nol-quick-input"));
    AppearanceFixture.expectPixels(popover.getBoundingClientRect().width, 22 * rem);
    AppearanceFixture.expectPixels(input.width, popover.clientWidth - Number.parseFloat(frame.paddingLeft) - Number.parseFloat(frame.paddingRight));
    expect([look.borderTopWidth, look.borderTopLeftRadius, look.backgroundColor, look.boxShadow, look.marginTop]).toEqual(["0px", "0px", "rgba(0, 0, 0, 0)", "none", "0px"]);
    AppearanceFixture.expectPixels(error.left, input.left);
    expect(error.top - input.bottom).toBeGreaterThanOrEqual(AppearanceFixture.measureLook("space-2") - 0.5);
    await userEvent.keyboard("{Escape}");
    await closedAsync();

    expect([offered, asked]).toEqual([["Offline", "New teammate…"], []]);
  });

  it("opens a new teammate's dialog with the typed name, closing the search, and places the teammate made there under the parent", async () => {
    await openAsync("Dana");
    await pickAsync("New teammate…");
    await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).not.toBeNull());
    await closedAsync();
    const shown = Required.of(document.querySelector<HTMLInputElement>("input.nol-teamrun-teammate-name")).value;
    one("button[form='nol-teamrun-teammate-form']").click();
    await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
    await Wait.until(() => expect(asked).toHaveLength(1));

    expect([shown, asked]).toEqual(["Dana", [new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "created",
      parent: { kind: "Department", id: "design" }, order: Resources.organizationLastOrder })]]);
  });
});
