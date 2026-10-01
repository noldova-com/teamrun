/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { TabComponent } from "../../../../src/app/components/tab/tab.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [TabComponent],
  template: `
    <div role="tablist">
      <tr-tab [label]="label()" [icon]="icon()" [selected]="selected()" [preview]="preview()" [working]="working()" [closable]="closable()"
        (activate)="activations = activations + 1" (close)="closes = closes + 1" />
    </div>
  `
})
class TabHostComponent {
  public readonly label = signal("Readme");
  public readonly icon = signal<string | undefined>(undefined);
  public readonly selected = signal(false);
  public readonly preview = signal(false);
  public readonly working = signal(false);
  public readonly closable = signal(true);
  public activations: number = 0;
  public closes: number = 0;
}

describe("TabComponent", () => {
  let fixture: ComponentFixture<TabHostComponent>;
  let host: TabHostComponent;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(TabHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(async () => {
    await userEvent.unhover(document.body);
    AppearanceFixture.reset();
  });

  function tab(): HTMLElement {
    return fixture.nativeElement.querySelector("tr-tab");
  }

  function part(selector: string): HTMLElement | null {
    return tab().querySelector<HTMLElement>(selector);
  }

  function update(change: () => void): void {
    change();
    fixture.detectChanges();
  }

  it("is a tab with its label, selection state and roving tab stop", () => {
    expect(tab().getAttribute("role")).toBe("tab");
    expect(tab().getAttribute("aria-selected")).toBe("false");
    expect(tab().getAttribute("tabindex")).toBe("-1");
    expect(tab().hasAttribute("aria-busy")).toBe(false);
    expect(part(".tr-tab-label")?.textContent).toBe("Readme");
    expect(part(".tr-tab-icon")).toBeNull();
    expect(part(".tr-tab-close")?.getAttribute("aria-label")).toBe("Close Readme");

    update(() => {
      host.selected.set(true);
      host.icon.set("description");
    });

    expect(tab().getAttribute("aria-selected")).toBe("true");
    expect(tab().getAttribute("tabindex")).toBe("0");
    expect(part(".tr-tab-icon")?.textContent).toBe("description");
  });

  it("activates on click, Enter and Space", () => {
    tab().click();
    tab().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const space = new KeyboardEvent("keydown", { key: " ", cancelable: true });
    tab().dispatchEvent(space);

    expect(host.activations).toBe(3);
    expect(space.defaultPrevented).toBe(true);
    expect(host.closes).toBe(0);
  });

  it("closes through its close button, Delete and middle-click without activating", () => {
    part(".tr-tab-close")?.click();
    tab().dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    const middle = new MouseEvent("auxclick", { button: 1, cancelable: true });
    tab().dispatchEvent(middle);
    tab().dispatchEvent(new MouseEvent("auxclick", { button: 2 }));

    expect(host.closes).toBe(3);
    expect(middle.defaultPrevented).toBe(true);
    expect(host.activations).toBe(0);
  });

  it("prevents autoscroll on a middle press only", () => {
    const middle = new MouseEvent("mousedown", { button: 1, cancelable: true });
    const primary = new MouseEvent("mousedown", { button: 0, cancelable: true });

    tab().dispatchEvent(middle);
    tab().dispatchEvent(primary);

    expect(middle.defaultPrevented).toBe(true);
    expect(primary.defaultPrevented).toBe(false);
  });

  it("has no close action when it cannot close", () => {
    update(() => host.closable.set(false));

    tab().dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    tab().dispatchEvent(new MouseEvent("auxclick", { button: 1 }));

    expect(part(".tr-tab-close")).toBeNull();
    expect(part(".tr-tab-action")).toBeNull();
    expect(host.closes).toBe(0);
  });

  it("shows a spinner while working and reveals its close action on hover", async () => {
    update(() => host.working.set(true));

    expect(tab().getAttribute("aria-busy")).toBe("true");
    expect(getComputedStyle(part(".tr-tab-spinner") ?? tab()).visibility).toBe("visible");
    expect(getComputedStyle(part(".tr-tab-close") ?? tab()).visibility).toBe("hidden");

    await userEvent.hover(tab());

    expect(getComputedStyle(part(".tr-tab-spinner") ?? tab()).visibility).toBe("hidden");
    expect(getComputedStyle(part(".tr-tab-close") ?? tab()).visibility).toBe("visible");
  });

  it("shows its close action only when selected, hovered or focused", async () => {
    expect(getComputedStyle(part(".tr-tab-close") ?? tab()).visibility).toBe("hidden");

    await userEvent.hover(tab());

    expect(getComputedStyle(part(".tr-tab-close") ?? tab()).visibility).toBe("visible");

    await userEvent.unhover(tab());
    update(() => host.selected.set(true));

    expect(getComputedStyle(part(".tr-tab-close") ?? tab()).visibility).toBe("visible");
  });

  it("shows a preview in italic", () => {
    expect(getComputedStyle(part(".tr-tab-label") ?? tab()).fontStyle).toBe("normal");

    update(() => host.preview.set(true));

    expect(getComputedStyle(part(".tr-tab-label") ?? tab()).fontStyle).toBe("italic");
  });

  it("keeps a visible focus outline after keyboard focus", async () => {
    update(() => host.selected.set(true));

    await userEvent.keyboard("{Tab}");

    expect(document.activeElement).toBe(tab());
    expect(getComputedStyle(part(".tr-tab-pill") ?? tab()).outlineStyle).toBe("solid");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and pill geometry from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);

        const unselected = getComputedStyle(tab());
        expect(unselected.color).toBe(AppearanceFixture.readColor(theme, mode, "teamrun.mutedForeground"));
        expect(getComputedStyle(part(".tr-tab-pill") ?? tab()).backgroundColor).toBe("rgba(0, 0, 0, 0)");

        await userEvent.hover(tab());
        expect(getComputedStyle(part(".tr-tab-pill") ?? tab()).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.hoverBackground"));

        update(() => host.selected.set(true));
        const pill = getComputedStyle(part(".tr-tab-pill") ?? tab());
        const tabStyle = getComputedStyle(tab());
        expect(tabStyle.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        expect(pill.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.inactiveSelectionBackground"));
        AppearanceFixture.expectLook(tabStyle.minHeight, theme, "tab-height", "min-height");
        AppearanceFixture.expectLook(tabStyle.paddingLeft, theme, "tab-inset", "padding-left");
        AppearanceFixture.expectLook(pill.minHeight, theme, "tab-pill", "min-height");
        AppearanceFixture.expectLook(pill.paddingLeft, theme, "tab-label-inset", "padding-left");
        AppearanceFixture.expectLook(pill.borderTopLeftRadius, theme, "radius-small", "border-top-left-radius");
        AppearanceFixture.expectLook(getComputedStyle(part(".tr-tab-action") ?? tab()).width, theme, "tab-action-slot", "width");
        AppearanceFixture.expectLook(getComputedStyle(part(".tr-tab-close") ?? tab(), "::before").width, theme, "tab-close", "width");
      });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`scales its geometry with panel size ${panelSize}`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
      update(() => host.selected.set(true));

      const pill = part(".tr-tab-pill") ?? tab();

      AppearanceFixture.expectRem(getComputedStyle(tab()).minHeight, 2, panelSize);
      AppearanceFixture.expectRem(getComputedStyle(pill).minHeight, 1.5, panelSize);
      AppearanceFixture.expectRem(getComputedStyle(pill).paddingRight, 0.25, panelSize);
      AppearanceFixture.expectRem(getComputedStyle(tab()).fontSize, 0.8125, panelSize);
      AppearanceFixture.expectPixels(tab().getBoundingClientRect().height, AppearanceFixture.toPixels(2, panelSize));
    });
});
