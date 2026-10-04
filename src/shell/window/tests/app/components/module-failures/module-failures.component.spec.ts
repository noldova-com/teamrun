/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { ModuleState } from "@noldova/teamrun-shell-protocol";

import { ModuleFailuresComponent } from "../../../../src/app/components/module-failures/module-failures.component";
import type { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { ShellDocuments } from "../../../../src/app/models/shell-documents";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { ModuleSelectionService } from "../../../../src/app/services/module-selection.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";

describe("ModuleFailuresComponent", () => {
  const clock = new ModuleFailure("clock", "Clock", ModuleState.Failed, "Its runtime part failed to activate.", ["clock.face"]);
  const notes = new ModuleFailure("notes", "Notes", ModuleState.Blocked, "It depends on clock, which is not active.", []);
  let failures: WritableSignal<readonly ModuleFailure[]>;
  let opened: DocumentTab[];

  beforeEach(() => {
    failures = signal([clock]);
    opened = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: { failures } },
        { provide: LayoutService, useValue: { openDocument: (tab: DocumentTab) => opened.push(tab) } }
      ]
    });
  });

  afterEach(() => {
    AppearanceFixture.reset();
  });

  async function renderAsync(): Promise<ComponentFixture<ModuleFailuresComponent>> {
    const fixture = TestBed.createComponent(ModuleFailuresComponent);
    await fixture.whenStable();
    return fixture;
  }

  function item(fixture: ComponentFixture<ModuleFailuresComponent>): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector("button.tr-module-failures-item") as HTMLButtonElement;
  }

  it("shows nothing while every module started", async () => {
    failures.set([]);

    const fixture = await renderAsync();

    expect((fixture.nativeElement as HTMLElement).textContent).toBe("");
  });

  it("counts the modules that didn't start, with an error icon and text", async () => {
    const fixture = await renderAsync();
    const one = item(fixture).textContent;
    failures.set([clock, notes]);
    await fixture.whenStable();

    expect(one).toMatch(/^\s*error\s*1 module didn't start\s*$/);
    expect(item(fixture).textContent).toMatch(/^\s*error\s*2 modules didn't start\s*$/);
    expect(item(fixture).hasAttribute("aria-haspopup")).toBe(false);
  });

  it("opens the Modules document with the first module that didn't start selected", async () => {
    failures.set([notes, clock]);
    const fixture = await renderAsync();

    item(fixture).click();

    expect(opened).toEqual([ShellDocuments.modulesTab]);
    expect(TestBed.inject(ModuleSelectionService).selected()).toBe("notes");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await renderAsync();
        const away = document.body.appendChild(document.createElement("div"));
        Object.assign(away.style, { position: "fixed", right: "0", bottom: "0", width: "40px", height: "40px" });
        await userEvent.hover(away);
        away.remove();

        const itemStyle = getComputedStyle(item(fixture));
        const icon = getComputedStyle(item(fixture).querySelector(".tr-module-failures-icon") as Element);

        expect(itemStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(icon.color).toBe(AppearanceFixture.readColor(theme, mode, "errorForeground"));
        AppearanceFixture.expectLook(itemStyle.paddingLeft, theme, "status-bar-item-padding", "padding-left");
        AppearanceFixture.expectLook(itemStyle.height, theme, "status-bar-item-height", "height");
        AppearanceFixture.expectLook(itemStyle.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
        AppearanceFixture.expectLook(icon.fontSize, theme, "icon", "font-size");
      });
});
