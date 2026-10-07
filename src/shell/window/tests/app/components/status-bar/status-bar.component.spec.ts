/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { StatusBarComponent } from "../../../../src/app/components/status-bar/status-bar.component";
import { StatusBarSide } from "../../../../src/app/enums/status-bar-side";
import { StatusBarItem } from "../../../../src/app/models/status-bar-item";
import { StatusBarItemContribution } from "../../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../../src/app/models/status-bar-item-state";
import { BarItemsService } from "../../../../src/app/services/bar-items.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { WindowPartHostFixture } from "../../../fixtures/window-part-host.fixture";

describe("StatusBarComponent", () => {
  let bridge: DesktopBridgeFixture;

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [WindowPartHostFixture.provide()] });
  });

  afterEach(() => {
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it("has an empty left side and the notifications bell on its right side", () => {
    const bar = render();

    expect([...bar.children].map(t => t.className)).toEqual(["tr-status-bar-side tr-status-bar-left", "tr-status-bar-side tr-status-bar-right"]);
    expect(bar.children[0]?.textContent).toBe("");
    expect(bar.querySelector(".tr-status-bar-right button.tr-notifications-item")?.getAttribute("aria-label")).toBe("Notifications");
    expect(bar.getAttribute("data-tr-chrome")).toBe("bottom");
  });

  it("shows the modules' items on their sides in order, with the shell's own items at the right end", () => {
    const item = (name: string, side: StatusBarSide): StatusBarItem =>
      new StatusBarItem(new StatusBarItemContribution(name, side, new StatusBarItemState(name)), () => undefined);
    TestBed.inject(BarItemsService).set(
      [item("notes.count", StatusBarSide.Left), item("clock.ticks", StatusBarSide.Right), item("notes.sync", StatusBarSide.Right), item("clock.zone", StatusBarSide.Left)], []);

    const bar = render();
    const names = (side: Element | undefined): readonly (string | null)[] => [...side?.children ?? []].map(t => t.getAttribute("data-tr-item") ?? t.tagName.toLowerCase());

    expect(names(bar.children[0])).toEqual(["notes.count", "clock.zone"]);
    expect(names(bar.children[1])).toEqual(["clock.ticks", "notes.sync", "tr-notifications", "tr-module-failures"]);
  });

  it("holds the update item before the notifications bell only while the update has something to show", async () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.detectChanges();
    const shown: (readonly string[])[] = [];
    for (const [kind, mustMove] of [["Downloading", false], ["Ready", false], ["Failed", false], ["UpToDate", false], ["Available", true], ["Failed", true]] as const) {
      bridge.publishUpdate({ kind, version: "1.3.0", progress: null, checkedAt: null, reason: null, mustMove });
      await fixture.whenStable();
      shown.push([...(fixture.nativeElement as HTMLElement).querySelectorAll(".tr-status-bar-right > *")].map(t => t.tagName.toLowerCase()));
    }

    const withItem = ["tr-update-item", "tr-notifications", "tr-module-failures"];
    const withoutItem = ["tr-notifications", "tr-module-failures"];
    expect(shown).toEqual([withoutItem, withItem, withItem, withoutItem, withItem, withItem]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const bar = render();
        const style = getComputedStyle(bar);
        const side = getComputedStyle(bar.children[0] ?? bar);

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "sideBar.background"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        AppearanceFixture.expectLook(style.minHeight, theme, "status-bar-height", "min-height");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "status-bar-inset", "padding-left");
        AppearanceFixture.expectLook(style.paddingRight, theme, "status-bar-inset", "padding-right");
        AppearanceFixture.expectLook(side.columnGap, theme, "status-bar-item-gap", "column-gap");
      });
});
