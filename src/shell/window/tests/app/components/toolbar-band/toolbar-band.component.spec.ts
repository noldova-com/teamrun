/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ToolbarBandComponent } from "../../../../src/app/components/toolbar-band/toolbar-band.component";
import { CommandRow } from "../../../../src/app/models/command-row";
import { MenuCheck } from "../../../../src/app/enums/menu-check";
import { MenuSection } from "../../../../src/app/models/menu-section";
import { Toolbar } from "../../../../src/app/models/toolbar";
import { ToolbarDropTarget } from "../../../../src/app/models/toolbar-drop-target";
import { ToolbarDragService } from "../../../../src/app/services/toolbar-drag.service";
import { ToolbarService } from "../../../../src/app/services/toolbar.service";
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

  afterEach(() => DesktopBridgeFixture.remove());

  it("shows each row that has a toolbar with something in it, numbered by its place among all the rows, and leaves out an empty toolbar", () => {
    expect([...element.querySelectorAll<HTMLElement>(".tr-toolbar-row")].map(t => t.dataset["toolbarRow"])).toEqual(["0", "2"]);
    expect([...element.querySelectorAll<HTMLElement>("tr-toolbar")].map(t => [t.dataset["toolbar"], t.dataset["toolbarIndex"]])).toEqual([["notes.main", "0"], ["notes.second", "0"]]);
  });

  it("shows nothing while no toolbar has anything to show", () => {
    hasContent.set(false);
    fixture.detectChanges();

    expect(element.querySelector(".tr-toolbar-band")).toBeNull();
  });

  it("marks the drop position of a toolbar in a row by a line and of a new row by another", () => {
    expect(element.querySelector(".tr-toolbar-drop")).toBeNull();

    target.set(new ToolbarDropTarget(0, 1, false, 120, 8, 28));
    fixture.detectChanges();
    const line = element.querySelector<HTMLElement>(".tr-toolbar-drop");

    expect([line?.classList.contains("tr-toolbar-drop-row"), line?.style.left, line?.style.top, line?.style.height, line?.style.width]).toEqual([false, "120px", "8px", "28px", ""]);

    target.set(new ToolbarDropTarget(1, 0, true, 0, 32, 400));
    fixture.detectChanges();

    expect([line?.classList.contains("tr-toolbar-drop-row"), line?.style.width, line?.style.height]).toEqual([true, "400px", ""]);
  });
});
