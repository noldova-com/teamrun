/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, inject, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { MatMenuModule } from "@angular/material/menu";

import { TabMenuComponent } from "../../../../src/app/components/tab-menu/tab-menu.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { Resources } from "../../../../src/resources";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";

@Component({
  imports: [MatMenuModule, TabMenuComponent],
  template: `
    @for (shown of shownTabs(); track shown.key) {
      <button type="button" class="tab" [attr.data-tab-key]="shown.key">{{ shown.key }}</button>
    }
    <tr-tab-menu #menu [tab]="tab()" />
    <button type="button" class="trigger" [matMenuTriggerFor]="menu.menu()">Open</button>
    <span class="keyboard" tabindex="0" (keydown)="menu.openFromKeyboard($event)" (contextmenu)="contextMenus.push($event)"></span>
  `
})
class TabMenuHostComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  public readonly tab = signal<Tab>(LayoutFixture.files);
  public readonly shownTabs: Signal<readonly Tab[]> = computed(() => this.layout.layout().groups.flatMap(t => t.tabs));
  public readonly contextMenus: MouseEvent[] = [];
}

describe("TabMenuComponent", () => {
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

    expect(items(".tr-tab-menu button[mat-menu-item]").map(t => t.textContent?.trim())).toEqual([
      `${Resources.moveToGlyph}${Resources.moveToLabel}`,
      `${Resources.splitGlyph}${Resources.splitLabel}`,
      `${Resources.dockGlyph}${Resources.dockLabel}`,
      `${Resources.moveEarlierGlyph}${Resources.moveEarlierLabel}`,
      `${Resources.moveLaterGlyph}${Resources.moveLaterLabel}`,
      `${Resources.closeGlyph}${Resources.closeTabLabel}`,
      `${Resources.resetLayoutGlyph}${Resources.resetLayoutLabel}`
    ]);
    expect(item(".tr-tab-menu-earlier").disabled).toBe(true);
    expect(item(".tr-tab-menu-later").disabled).toBe(false);
    expect(item(".tr-tab-menu-split").disabled).toBe(false);

    await clickAsync(item(".tr-tab-menu-move"));
    expect(items(".tr-tab-menu-destination").map(t => t.textContent?.trim())).toEqual(["git.changes", Resources.documentsGroupLabel]);
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
    expect(item(".tr-tab-menu-split").disabled).toBe(true);
    await clickAsync(item(".tr-tab-menu-dock"));
    expect(items(".tr-tab-menu-dock-side").map(t => t.dataset["side"])).toEqual([DockSide.Left, DockSide.Right, DockSide.Bottom]);
    await clickAsync(item(".tr-tab-menu-dock-side[data-side=\"Bottom\"]"));

    expect(layout.layout().sideOf(layout.layout().groupOf(LayoutFixture.files)?.id ?? -1)).toBe(DockSide.Bottom);
  });

  it("names a group of several views by their labels", async () => {
    await renderAsync(LayoutFixture.changes);
    await openAsync();
    await clickAsync(item(".tr-tab-menu-move"));

    expect(items(".tr-tab-menu-destination").map(t => t.textContent?.trim())).toEqual(["files.tree, files.search", Resources.documentsGroupLabel]);
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
    expect(item(".tr-tab-menu-later").disabled).toBe(true);
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
    expect(items(".tr-tab-menu button[mat-menu-item]").map(t => [...t.classList].find(name => name.startsWith("tr-tab-menu-")))).toEqual(["tr-tab-menu-close", "tr-tab-menu-reset"]);
    await clickAsync(item(".tr-tab-menu-close"));
    expect(focusedKey()).toBeUndefined();

    const alone = new ViewTab("files.tree", "alone");
    fixture.destroy();
    await renderAsync(alone, Layout.createDefault(registry).toggleDock(DockSide.Left).moveTab(alone, 0, 0).close(LayoutFixture.files).close(LayoutFixture.changes));
    await openAsync();
    expect(item(".tr-tab-menu-move").disabled).toBe(true);
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

  it("opens the context menu from Shift+F10 and the menu key and ignores other keys", async () => {
    await renderAsync(LayoutFixture.files);
    const keyboard: HTMLElement = fixture.nativeElement.querySelector(".keyboard");
    const keys = [new KeyboardEvent("keydown", { key: "F10", shiftKey: true, cancelable: true }), new KeyboardEvent("keydown", { key: "ContextMenu", cancelable: true }),
      new KeyboardEvent("keydown", { key: "F10", cancelable: true }), new KeyboardEvent("keydown", { key: "a", cancelable: true })];
    for (const key of keys)
      keyboard.dispatchEvent(key);

    expect(keys.map(t => t.defaultPrevented)).toEqual([true, true, false, false]);
    expect(fixture.componentInstance.contextMenus.length).toBe(2);
    expect(fixture.componentInstance.contextMenus[0]?.clientY).toBe(keyboard.getBoundingClientRect().bottom);

    const detached = new KeyboardEvent("keydown", { key: "ContextMenu", cancelable: true });
    document.dispatchEvent(detached);
    expect(detached.defaultPrevented).toBe(false);
  });
});
