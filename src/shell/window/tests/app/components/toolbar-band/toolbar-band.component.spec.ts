/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { AppearanceService, DefaultTheme, ThemeMode, Typography } from "@noldova/teamrun-shell-ui";

import { ToolbarBandComponent } from "../../../../src/app/components/toolbar-band/toolbar-band.component";
import { CommandRow } from "../../../../src/app/models/command-row";
import { MenuCheck } from "../../../../src/app/enums/menu-check";
import { MenuSection } from "../../../../src/app/models/menu-section";
import { Toolbar } from "../../../../src/app/models/toolbar";
import { ToolbarDropTarget } from "../../../../src/app/models/toolbar-drop-target";
import { ToolbarDragService } from "../../../../src/app/services/toolbar-drag.service";
import { ToolbarService } from "../../../../src/app/services/toolbar.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("ToolbarBandComponent", () => {
  const section = new MenuSection("notes.create", [new CommandRow("notes.newNote", {}, "New note", "note", null, true, MenuCheck.None, false)]);
  const rows: WritableSignal<readonly (readonly Toolbar[])[]> = signal([]);
  const target: WritableSignal<ToolbarDropTarget | null> = signal(null);
  const hasContent: WritableSignal<boolean> = signal(true);
  let fixture: ComponentFixture<ToolbarBandComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    rows.set([[new Toolbar("notes.main", "Main", [section]), new Toolbar("notes.empty", "Empty", [])], [new Toolbar("notes.hollow", "Hollow", [])], [new Toolbar("notes.second", "Second", [section])]]);
    target.set(null);
    hasContent.set(true);
    DesktopBridgeFixture.install();
    TestBed.configureTestingModule({
      providers: [
        { provide: ToolbarService, useValue: { rows, hasContent } },
        { provide: ToolbarDragService, useValue: { dragging: signal(null), begin: vi.fn(), target } }
      ]
    });
    fixture = TestBed.createComponent(ToolbarBandComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  it("shows each row that has a toolbar with something in it, numbered by its place among all the rows, and leaves out an empty toolbar", () => {
    expect([...element.querySelectorAll<HTMLElement>(".tr-toolbar-row")].map(t => t.dataset["toolbarRow"])).toEqual(["0", "2"]);
    expect([...element.querySelectorAll<HTMLElement>("tr-toolbar")].map(t => [t.dataset["toolbar"], t.dataset["toolbarIndex"]])).toEqual([["notes.main", "0"], ["notes.second", "0"]]);
  });

  for (const panelSize of [12, 13, 18])
    for (const count of [1, 2])
      it(`stands ${count} row${count === 1 ? "" : "s"} a button high and 0.25rem apart from its top, with 0.25rem below the last, at panel size ${panelSize}`, () => {
        if (count === 1)
          rows.set([[new Toolbar("notes.main", "Main", [section])]]);
        AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
        TestBed.inject(AppearanceService).setTypography(new Typography(panelSize));
        TestBed.tick();
        const band = element.getBoundingClientRect();
        const shown = [...element.querySelectorAll<HTMLElement>(".tr-toolbar-row")].map(t => t.getBoundingClientRect());
        const between = shown.slice(1).map((t, index) => t.top - (shown[index]?.bottom ?? Number.NaN));
        const gap = AppearanceFixture.toPixels(0.25, panelSize);

        expect(shown).toHaveLength(count);
        for (const row of shown)
          AppearanceFixture.expectPixels(row.height, AppearanceFixture.toPixels(1.5, panelSize));
        AppearanceFixture.expectPixels((shown[0]?.top ?? Number.NaN) - band.top, 0);
        for (const space of between)
          AppearanceFixture.expectPixels(space, gap);
        AppearanceFixture.expectPixels(band.bottom - (shown.at(-1)?.bottom ?? Number.NaN), gap);
      });

  it("shows nothing while no toolbar has anything to show", () => {
    hasContent.set(false);
    fixture.detectChanges();

    expect(element.querySelector(".tr-toolbar-band")).toBeNull();
  });

  it("marks the drop position of a toolbar in a row by a line and of a new row by another", () => {
    expect(element.querySelector(".tr-toolbar-drop")).toBeNull();

    target.set(new ToolbarDropTarget(0, 1, false, 120, 20, 0));
    fixture.detectChanges();
    const line = element.querySelector<HTMLElement>(".tr-toolbar-drop");

    expect([line?.classList.contains("tr-drop-line"), line?.classList.contains("tr-drop-line-row"), line?.style.left, line?.style.top, line?.style.width]).toEqual([true, false, "120px", "20px", ""]);

    target.set(new ToolbarDropTarget(1, 0, true, 0, 32, 400));
    fixture.detectChanges();

    expect([line?.classList.contains("tr-drop-line-row"), line?.style.width]).toEqual([true, "400px"]);
  });
});
