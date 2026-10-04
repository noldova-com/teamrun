/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { MenuDirective } from "../../../src/app/directives/menu.directive";
import type { IWindowPartContext } from "../../../src/app/interfaces/i-window-part-context";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { MenuDeclarations } from "../../../src/app/models/menu-declarations";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../src/app/services/command.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

@Component({
  imports: [MenuDirective],
  template: `<button type="button" class="note" [trMenu]="place()" [trMenuContext]="{ week: week() }">Week</button>`
})
class HostComponent {
  public readonly place: Signal<string> = signal("notes.listItem");
  public readonly week: Signal<number> = signal(3);
}

describe("MenuDirective", () => {
  let runs: string[];

  function start(): void {
    runs = [];
    DesktopBridgeFixture.install();
    const context = { isAllowed: (name: string) => name.startsWith("notes.") } as unknown as IWindowPartContext;
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartTokens.context, useValue: context },
        {
          provide: WindowPartTokens.menus, useValue: [MenuDeclarations.fromJson("notes", {
            places: [{ name: "notes.listItem", title: "Note", shows: "menu" }],
            groups: [{ name: "notes.open", place: "notes.listItem", exclusive: false, items: [{ command: "notes.openNote", arguments: {} }] }]
          })]
        }
      ]
    });
    TestBed.inject(CommandService).setCommands([new CommandContribution("notes.openNote", "Open note", null, null, async t => {
      runs.push(JSON.stringify(t));
      return null;
    })]);
    TestBed.inject(MenuService).setActiveModules(["notes"]);
  }

  afterEach(() => DesktopBridgeFixture.remove());

  it("opens its module's place as a context menu with its context, and the row runs with it", () => {
    start();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const note = fixture.nativeElement.querySelector(".note") as HTMLButtonElement;

    note.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    (document.querySelector("tr-menu[data-place='notes.listItem'] button[tr-menu-item]") as HTMLButtonElement).click();

    expect(runs).toEqual([JSON.stringify({ week: 3 })]);
  });

  it("refuses another module's place", () => {
    start();
    const fixture = TestBed.createComponent(HostComponent);
    (fixture.componentInstance.place as ReturnType<typeof signal<string>>).set("clock.face");

    expect(() => fixture.detectChanges()).toThrowError("A module may open only its own menus and those of the modules it depends on, not clock.face.");
  });
});
