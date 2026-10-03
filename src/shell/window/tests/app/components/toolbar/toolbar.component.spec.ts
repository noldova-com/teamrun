/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ToolbarComponent } from "../../../../src/app/components/toolbar/toolbar.component";
import { MenuCheck } from "../../../../src/app/enums/menu-check";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { CommandRow } from "../../../../src/app/models/command-row";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import { MenuSection } from "../../../../src/app/models/menu-section";
import { SubmenuRow } from "../../../../src/app/models/submenu-row";
import { Toolbar } from "../../../../src/app/models/toolbar";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../../src/app/services/command.service";
import { MenuService } from "../../../../src/app/services/menu.service";
import { ToolbarDragService } from "../../../../src/app/services/toolbar-drag.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

@Component({
  imports: [ToolbarComponent],
  template: `<div class="frame" [style.width.px]="width()"><tr-toolbar [toolbar]="toolbar()" /></div>`
})
class HostComponent {
  public readonly width: WritableSignal<number> = signal(1000);
  public readonly toolbar: WritableSignal<Toolbar> = signal(new Toolbar("notes.main", "Main", []));
}

describe("ToolbarComponent", () => {
  const row = (command: string, title: string, key: string | null = null, isEnabled: boolean = true, check: MenuCheck = MenuCheck.None, isChecked: boolean = false): CommandRow =>
    new CommandRow(command, { by: "title" }, title, "note", key, isEnabled, check, isChecked);
  const sections = [
    new MenuSection("notes.create", [row("notes.newNote", "New note", "Ctrl+N"), row("notes.locked", "Locked", null, false)]),
    new MenuSection("notes.display", [row("notes.wrap", "Wrap", null, true, MenuCheck.Checkbox, true)]),
    new MenuSection("notes.more", [new SubmenuRow("notes.templates", "Templates", "note_add")])
  ];
  const dragging: WritableSignal<string | null> = signal(null);
  const begin = vi.fn();
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let errors: unknown[];
  let runs: string[];
  let reported: Promise<void>;
  let report: () => void;
  let style: HTMLStyleElement;

  beforeEach(() => {
    errors = [];
    runs = [];
    reported = new Promise<void>(resolve => report = resolve);
    dragging.set(null);
    begin.mockClear();
    DesktopBridgeFixture.install();
    TestBed.configureTestingModule({
      providers: [
        { provide: ToolbarDragService, useValue: { dragging, begin } },
        {
          provide: ErrorHandler, useValue: {
            handleError: (error: unknown) => {
              errors.push(error);
              report();
            }
          }
        },
        {
          provide: WindowPartTokens.menus, useValue: [MenuDeclarations.fromJson("notes", {
            places: [{ name: "notes.templates", title: "Templates", shows: "menu" }],
            groups: [{ name: "notes.fromTemplate", place: "notes.templates", exclusive: false, items: [{ command: "notes.newNote", arguments: {} }] }]
          })]
        }
      ]
    });
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("notes.newNote", "New note", null, null, async t => {
        runs.push(JSON.stringify(t));
        return null;
      }),
      new CommandContribution("notes.locked", "Locked", null, null, () => Promise.resolve(null), () => false),
      new CommandContribution("notes.wrap", "Wrap", null, null, () => Promise.reject(new Error("No wrap.")))
    ]);
    TestBed.inject(MenuService).setActiveModules(["notes"]);
    style = document.createElement("style");
    style.textContent = "tr-toolbar button[tr-toolbar-button] { display: inline-block; width: 30px; height: 20px; padding: 0; overflow: hidden; }";
    document.head.append(style);
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    style.remove();
    DesktopBridgeFixture.remove();
  });

  async function showAsync(width: number): Promise<void> {
    fixture.componentInstance.width.set(width);
    fixture.componentInstance.toolbar.set(new Toolbar("notes.main", "Main", sections));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const items = (): readonly HTMLButtonElement[] => [...element.querySelectorAll<HTMLButtonElement>("button.tr-toolbar-item")];
  const identity = (item: HTMLElement): string => item.dataset["command"] ?? item.dataset["submenu"] ?? "overflow";

  it("shows each section's items apart by separators, with their pressed and unavailable state", async () => {
    await showAsync(1000);

    expect(items().map(identity)).toEqual(["notes.newNote", "notes.locked", "notes.wrap", "notes.templates"]);
    expect(element.querySelectorAll(".tr-toolbar-content > .tr-toolbar-separator[role=separator]").length).toBe(2);
    expect(element.querySelector(".tr-toolbar-overflow")).toBeNull();
    expect(items().map(t => [t.getAttribute("aria-pressed"), t.getAttribute("aria-disabled")])).toEqual([[null, null], [null, "true"], ["true", null], [null, null]]);
    expect(element.querySelector(".tr-toolbar-content")?.getAttribute("aria-label")).toBe("Main");
    expect(element.querySelector("tr-toolbar")?.getAttribute("data-toolbar")).toBe("notes.main");
  });

  it("runs the command of an available item with its arguments, not an unavailable one, and reports a failure", async () => {
    await showAsync(1000);

    items()[0]?.click();
    items()[1]?.click();
    items()[2]?.click();
    await reported;

    expect(runs).toEqual([JSON.stringify({ by: "title" })]);
    expect(errors.map(t => String(t))).toEqual(["Error: No wrap."]);
  });

  it("opens the place of a submenu item as a dropdown", async () => {
    await showAsync(1000);

    items()[3]?.click();
    fixture.detectChanges();

    expect(document.querySelector("tr-menu[data-place='notes.templates'] button[tr-menu-item]")).not.toBeNull();
  });

  it("moves the sections that do not fit into a menu behind a More actions item", async () => {
    await showAsync(100);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector(".tr-toolbar-overflow")).not.toBeNull();
    });

    expect(items().map(identity)).toEqual(["notes.newNote", "notes.locked", "overflow"]);
    (element.querySelector(".tr-toolbar-overflow") as HTMLButtonElement).click();
    fixture.detectChanges();
    const labels = [...document.querySelectorAll<HTMLElement>("tr-menu button[tr-menu-item] .tr-menu-item-label")].map(t => t.textContent);

    expect(labels).toEqual(["Wrap", "Templates"]);
  });

  it("takes the items back out of the menu when the toolbar grows", async () => {
    await showAsync(100);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector(".tr-toolbar-overflow")).not.toBeNull();
    });

    fixture.componentInstance.width.set(1000);

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector(".tr-toolbar-overflow")).toBeNull();
    });
  });

  it("starts moving the toolbar from its grip and fades while it is dragged", async () => {
    await showAsync(1000);

    element.querySelector(".tr-toolbar-grip")?.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }));
    dragging.set("notes.main");
    fixture.detectChanges();

    expect(begin).toHaveBeenCalledWith("notes.main", expect.any(PointerEvent));
    expect(element.querySelector("tr-toolbar")?.classList.contains("tr-toolbar-dragging")).toBe(true);
  });
});
