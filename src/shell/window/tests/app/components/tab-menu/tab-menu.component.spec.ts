/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, inject, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { MenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { TabMenuComponent } from "../../../../src/app/components/tab-menu/tab-menu.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { Resources } from "../../../../src/resources";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";

@Component({
  imports: [MenuTriggerDirective, TabMenuComponent],
  template: `
    @for (shown of shownTabs(); track shown.key) {
      <button type="button" class="tab" [attr.data-tab-key]="shown.key">{{ shown.key }}</button>
    }
    <tr-tab-menu #menu [tab]="tab()" />
    <button type="button" class="trigger" [trMenuTriggerFor]="menu.menu()">Open</button>
  `
})
class TabMenuHostComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  public readonly tab = signal<Tab>(LayoutFixture.files);
  public readonly shownTabs: Signal<readonly Tab[]> = computed(() => this.layout.layout().groups.flatMap(t => t.tabs));
}

describe("TabMenuComponent", () => {
  beforeEach(() => {
    DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openView(LayoutFixture.search, registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
  let fixture: ComponentFixture<TabMenuHostComponent>;
  let layout: LayoutService;

  async function renderAsync(tab: Tab, initial: Layout = prepared): Promise<void> {
    layout = await LayoutServiceFixture.prepareAsync(registry, initial);
    fixture = TestBed.createComponent(TabMenuHostComponent);
    fixture.componentInstance.tab.set(tab);
    fixture.detectChanges();
  }

  function items(selector: string): HTMLButtonElement[] {
    return [...document.querySelectorAll<HTMLButtonElement>(`.cdk-overlay-container ${selector}`)];
  }

  function item(selector: string): HTMLButtonElement {
    const found = items(selector).at(-1);
    if (Object.isUndefined(found))
      throw new Error(`No ${selector} item is shown.`);
    return found;
  }

  function labels(selector: string): (string | undefined)[] {
    return items(selector).map(t => t.querySelector(".tr-menu-item-label")?.textContent);
  }

  function isDisabled(selector: string): boolean {
    return item(selector).getAttribute("aria-disabled") === "true";
  }

  async function clickAsync(element: HTMLElement): Promise<void> {
    element.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function openAsync(): Promise<void> {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(".trigger");
    await clickAsync(trigger);
  }

  function focusedKey(): string | undefined {
    return document.activeElement instanceof HTMLElement ? document.activeElement.dataset["tabKey"] : undefined;
  }

  afterEach(() => {
    document.querySelector(".cdk-overlay-container")?.replaceChildren();
  });

  it("offers moving, splitting, docking, reordering, closing and resetting for a view", async () => {
    await renderAsync(LayoutFixture.files);
    await openAsync();

    expect(labels(".tr-tab-menu button[tr-menu-item]")).toEqual([
      Resources.moveToLabel, Resources.splitLabel, Resources.dockLabel, Resources.moveEarlierLabel, Resources.moveLaterLabel, Resources.closeTabLabel, Resources.closeOthersLabel,
      Resources.closeToTheRightLabel, Resources.closeAllLabel, Resources.resetLayoutLabel
    ]);
    expect(items(".tr-tab-menu button[tr-menu-item]").map(t => t.querySelector(".tr-menu-item-icon")?.textContent)).toEqual([
      Resources.moveToGlyph, Resources.splitGlyph, Resources.dockGlyph, Resources.moveEarlierGlyph, Resources.moveLaterGlyph, Resources.closeGlyph, Resources.closeOthersGlyph,
      Resources.closeToTheRightGlyph, Resources.closeAllGlyph, Resources.resetLayoutGlyph
    ]);
    expect(items(".tr-tab-menu tr-menu-separator").length).toBe(2);
    expect(isDisabled(".tr-tab-menu-earlier")).toBe(true);
    expect(isDisabled(".tr-tab-menu-later")).toBe(false);
    expect(isDisabled(".tr-tab-menu-split")).toBe(false);

    await clickAsync(item(".tr-tab-menu-move"));
    expect(labels(".tr-tab-menu-destination")).toEqual(["git.changes", Resources.documentsGroupLabel]);
    await clickAsync(item(".tr-tab-menu-destination[data-group=\"2\"]"));

    expect(layout.layout().groupOf(LayoutFixture.files)?.id).toBe(2);
    expect(focusedKey()).toBe(LayoutFixture.files.key);
  });

  it("splits the view's group and docks the view", async () => {
    await renderAsync(LayoutFixture.files);
    await openAsync();
    await clickAsync(item(".tr-tab-menu-split"));
    await clickAsync(item(".tr-tab-menu-split-edge[data-edge=\"Bottom\"]"));

    const group = layout.layout().groupOf(LayoutFixture.files);
    expect(group?.tabs).toEqual([LayoutFixture.files]);
    expect(layout.layout().sideOf(group?.id ?? -1)).toBe(DockSide.Left);

    await openAsync();
    expect(isDisabled(".tr-tab-menu-split")).toBe(true);
    await clickAsync(item(".tr-tab-menu-split"));
    expect(items(".tr-tab-menu-split-edge").length).toBe(0);
    await clickAsync(item(".tr-tab-menu-dock"));
    expect(items(".tr-tab-menu-dock-side").map(t => t.dataset["side"])).toEqual([DockSide.Left, DockSide.Right, DockSide.Bottom]);
    await clickAsync(item(".tr-tab-menu-dock-side[data-side=\"Bottom\"]"));

    expect(layout.layout().sideOf(layout.layout().groupOf(LayoutFixture.files)?.id ?? -1)).toBe(DockSide.Bottom);
  });

  it("names a group of several views by their labels", async () => {
    await renderAsync(LayoutFixture.changes);
    await openAsync();
    await clickAsync(item(".tr-tab-menu-move"));

    expect(labels(".tr-tab-menu-destination")).toEqual(["files.tree, files.search", Resources.documentsGroupLabel]);
  });

  it("reorders a document, closes it and focuses the next tab, and resets the layout", async () => {
    await renderAsync(LayoutFixture.plan);
    await openAsync();

    expect(items(".tr-tab-menu-move").length).toBe(0);
    expect(items(".tr-tab-menu-split").length).toBe(0);
    await clickAsync(item(".tr-tab-menu-later"));
    expect(layout.layout().documents.tabs).toEqual([LayoutFixture.todo, LayoutFixture.plan]);
    expect(focusedKey()).toBe(LayoutFixture.plan.key);

    await openAsync();
    expect(isDisabled(".tr-tab-menu-later")).toBe(true);
    await clickAsync(item(".tr-tab-menu-earlier"));
    expect(layout.layout().documents.tabs).toEqual([LayoutFixture.plan, LayoutFixture.todo]);

    await openAsync();
    await clickAsync(item(".tr-tab-menu-close"));
    expect(layout.layout().isOpen(LayoutFixture.plan)).toBe(false);
    expect(focusedKey()).toBe(LayoutFixture.todo.key);

    fixture.componentInstance.tab.set(LayoutFixture.todo);
    fixture.detectChanges();
    await openAsync();
    await clickAsync(item(".tr-tab-menu-reset"));
    expect(layout.layout().dock(DockSide.Left).root?.groups.flatMap(t => t.tabs)).toEqual([LayoutFixture.files, LayoutFixture.search]);
    expect(layout.layout().documents.tabs).toEqual([LayoutFixture.todo]);
  });

  it("offers only closing and resetting for a tab outside the layout, and moving nowhere when no other group takes it", async () => {
    await renderAsync(new ViewTab("absent.view"));
    await openAsync();
    expect(items(".tr-tab-menu button[tr-menu-item]").map(t => [...t.classList].find(name => name.startsWith("tr-tab-menu-")))).toEqual(["tr-tab-menu-close", "tr-tab-menu-reset"]);
    await clickAsync(item(".tr-tab-menu-close"));
    expect(focusedKey()).toBeUndefined();

    const alone = new ViewTab("files.tree", "alone");
    fixture.destroy();
    await renderAsync(alone, Layout.createDefault(registry).toggleDock(DockSide.Left).moveTab(alone, 0, 0).close(LayoutFixture.files).close(LayoutFixture.changes));
    await openAsync();
    expect(isDisabled(".tr-tab-menu-move")).toBe(true);
    await clickAsync(item(".tr-tab-menu-move"));
    expect(items(".tr-tab-menu-destination").length).toBe(0);
  });

  it("closes the last tab of a group and the last document without moving focus", async () => {
    await renderAsync(LayoutFixture.changes, Layout.createDefault(registry).openDocument(LayoutFixture.plan));
    await openAsync();
    await clickAsync(item(".tr-tab-menu-close"));
    expect(layout.layout().isOpen(LayoutFixture.changes)).toBe(false);
    expect(focusedKey()).toBeUndefined();

    fixture.componentInstance.tab.set(LayoutFixture.plan);
    fixture.detectChanges();
    await openAsync();
    await clickAsync(item(".tr-tab-menu-close"));
    expect(layout.layout().documents.tabs).toEqual([]);
    expect(focusedKey()).toBeUndefined();
  });

  it("closes the tabs to the right, then the others, keeping focus on the tab, and offers neither once nothing is left to close", async () => {
    await renderAsync(LayoutFixture.plan, prepared.openDocument(new DocumentTab("notes.note", "third")));
    await openAsync();
    await clickAsync(item(".tr-tab-menu-close-right"));

    expect(layout.layout().documents.tabs).toEqual([LayoutFixture.plan]);
    expect(focusedKey()).toBe(LayoutFixture.plan.key);
    await openAsync();
    expect(isDisabled(".tr-tab-menu-close-others")).toBe(true);
    expect(isDisabled(".tr-tab-menu-close-right")).toBe(true);
    await clickAsync(item(".tr-tab-menu-close-others"));
    expect(layout.layout().documents.tabs).toEqual([LayoutFixture.plan]);
    expect(items(".tr-tab-menu").length).toBe(1);
    await openAsync();
    expect(items(".tr-tab-menu").length).toBe(0);

    fixture.componentInstance.tab.set(LayoutFixture.search);
    fixture.detectChanges();
    await openAsync();
    await clickAsync(item(".tr-tab-menu-close-others"));
    expect(layout.layout().groupOf(LayoutFixture.search)?.tabs).toEqual([LayoutFixture.search]);
    expect(focusedKey()).toBe(LayoutFixture.search.key);
  });

  it("closes every tab of its group", async () => {
    await renderAsync(LayoutFixture.plan);
    await openAsync();
    await clickAsync(item(".tr-tab-menu-close-all"));

    expect(layout.layout().documents.tabs).toEqual([]);
    expect(layout.layout().isOpen(LayoutFixture.files)).toBe(true);
  });
});
