/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Signal, type TemplateRef, viewChild } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { MenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { PlaceMenuComponent } from "../../../../src/app/components/place-menu/place-menu.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import type { MenuSection } from "../../../../src/app/models/menu-section";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../../src/app/services/command.service";
import { MenuService } from "../../../../src/app/services/menu.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

@Component({
  imports: [PlaceMenuComponent, MenuTriggerDirective],
  template: `<tr-place-menu #menu [place]="'notes.listItem'" [context]="{ week: 3 }" /><button type="button" class="opener" [trMenuTriggerFor]="menu.menu()">Open</button>`
})
class HostComponent {
  public readonly menu: Signal<PlaceMenuComponent> = viewChild.required(PlaceMenuComponent);
}

@Component({
  imports: [PlaceMenuComponent, MenuTriggerDirective],
  template: `<tr-place-menu #menu [rows]="rows" /><button type="button" class="opener" [trMenuTriggerFor]="menu.menu()">Open</button>`
})
class RowsHostComponent {
  public readonly rows: readonly MenuSection[] = TestBed.inject(MenuService).resolve("notes.listItem").slice(0, 1);
}

describe("PlaceMenuComponent", () => {
  let errors: unknown[];
  let reported: Promise<void>;
  let report: () => void;
  let runs: string[];

  beforeEach(() => {
    errors = [];
    reported = new Promise<void>(resolve => report = resolve);
    runs = [];
    DesktopBridgeFixture.install();
    TestBed.configureTestingModule({
      providers: [
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
            places: [{ name: "notes.listItem", title: "Note", shows: "menu" }, { name: "notes.templates", title: "New from template", shows: "menu" }],
            groups: [
              { name: "notes.open", place: "notes.listItem", exclusive: false, items: [{ command: "notes.openNote", arguments: {} }, { submenu: "notes.templates" }] },
              { name: "notes.risky", place: "notes.listItem", exclusive: false, items: [{ command: "notes.fail", arguments: {} }, { command: "notes.locked", arguments: {} }] },
              { name: "notes.sorting", place: "notes.listItem", exclusive: true, items: [{ command: "notes.sortBy", arguments: { by: "title" } }, { command: "notes.sortBy", arguments: { by: "week" } }] },
              { name: "notes.display", place: "notes.listItem", exclusive: false, items: [{ command: "notes.wrapLines", arguments: {} }] },
              { name: "notes.fromTemplate", place: "notes.templates", exclusive: false, items: [{ command: "notes.openNote", arguments: { template: "plan" } }] }
            ]
          })]
        }
      ]
    });
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("notes.openNote", "Open note", "open_in_new", "Mod+Alt+O", async t => {
        runs.push(JSON.stringify(t));
        return null;
      }),
      new CommandContribution("notes.fail", "Fail", null, null, () => Promise.reject(new Error("The note is gone."))),
      new CommandContribution("notes.locked", "Locked", null, null, () => Promise.resolve(null), () => false),
      new CommandContribution("notes.sortBy", "Sort by", null, null, () => Promise.resolve(null), () => true, t => JsonReader.fromValue(t).readString("by") === "week"),
      new CommandContribution("notes.wrapLines", "Wrap lines", null, null, () => Promise.resolve(null), () => true, () => true)
    ]);
    TestBed.inject(MenuService).setActiveModules(["notes"]);
  });

  afterEach(() => DesktopBridgeFixture.remove());

  function open(): HTMLElement {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(".opener") as HTMLButtonElement).click();
    fixture.detectChanges();
    return document.querySelector("tr-menu[data-place='notes.listItem']") as HTMLElement;
  }

  it("shows a place's groups apart, its rows with their titles, keys and enabled state, and runs a row with the merged arguments", () => {
    const menu = open();
    const rows = [...menu.querySelectorAll<HTMLButtonElement>("button[tr-menu-item]")];

    rows[0]?.click();

    expect(rows.map(t => [t.querySelector(".tr-menu-item-label")?.textContent, t.getAttribute("aria-disabled") === "true"])).toEqual([
      ["Open note", false], ["New from template", false], ["Fail", false], ["Locked", true], ["Sort by", false], ["Sort by", false], ["Wrap lines", false]
    ]);
    expect(rows[0]?.textContent).toContain("Ctrl+Alt+O");
    expect(menu.querySelectorAll("tr-menu-separator").length).toBe(3);
    expect(runs).toEqual([JSON.stringify({ week: 3 })]);
  });

  it("shows a checked command as a radio row in an exclusive group and as a checkbox row elsewhere", () => {
    const rows = [...open().querySelectorAll<HTMLButtonElement>("button[tr-menu-item]")];

    expect(rows.map(t => [t.getAttribute("role"), t.getAttribute("aria-checked")])).toEqual([
      ["menuitem", null], ["menuitem", null], ["menuitem", null], ["menuitem", null], ["menuitemradio", "false"], ["menuitemradio", "true"], ["menuitemcheckbox", "true"]
    ]);
  });

  it("reports a row whose command fails", async () => {
    const menu = open();

    (menu.querySelectorAll<HTMLButtonElement>("button[tr-menu-item]")[2] as HTMLButtonElement).click();
    await reported;

    expect(errors.map(t => String(t))).toEqual(["Error: The note is gone."]);
  });

  it("opens a submenu's place with the same context", () => {
    const menu = open();

    (menu.querySelector("button.tr-place-menu-submenu") as HTMLButtonElement).click();
    const submenu = document.querySelector("tr-menu[data-place='notes.templates']") as HTMLElement;
    (submenu.querySelector("button[tr-menu-item]") as HTMLButtonElement).click();

    expect(runs).toEqual([JSON.stringify({ week: 3, template: "plan" })]);
  });

  it("shows the rows it is given instead of resolving a place", () => {
    const fixture = TestBed.createComponent(RowsHostComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(".opener") as HTMLButtonElement).click();
    fixture.detectChanges();
    const rows = [...document.querySelectorAll<HTMLButtonElement>("tr-menu[data-place=''] button[tr-menu-item]")];

    expect(rows.map(t => t.querySelector(".tr-menu-item-label")?.textContent)).toEqual(["Open note", "New from template"]);
  });

  it("exposes its menu as a template", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const template: TemplateRef<unknown> = fixture.componentInstance.menu().menu();

    expect(template).toBeDefined();
  });
});
