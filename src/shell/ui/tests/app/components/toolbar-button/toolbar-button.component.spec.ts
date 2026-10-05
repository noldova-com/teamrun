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

import { ToolbarButtonComponent } from "../../../../src/app/components/toolbar-button/toolbar-button.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [ToolbarButtonComponent],
  template: `
    <button type="button" tr-toolbar-button [label]="label()" [icon]="icon()" [isShowingLabel]="isShowingLabel()" [hasMenu]="hasMenu()" [pressed]="pressed()"
      [isUnavailable]="isUnavailable()"></button>
    @for (direction of directions; track direction) {
      <div class="row" [attr.dir]="direction" [attr.data-direction]="direction" style="display: flex; width: 8rem">
        <button type="button" tr-toolbar-button class="long" icon="save" [isShowingLabel]="true" [hasMenu]="true" label="A label far too long to fit the row its toolbar is given"></button>
        <button type="button" tr-toolbar-button class="after" icon="add" label="Add"></button>
      </div>
    }
  `
})
class ToolbarButtonHostComponent {
  public readonly directions: readonly string[] = ["ltr", "rtl"];
  public readonly label = signal("Bold");
  public readonly icon = signal<string | null>("format_bold");
  public readonly isShowingLabel = signal(false);
  public readonly hasMenu = signal(false);
  public readonly pressed = signal<boolean | undefined>(undefined);
  public readonly isUnavailable = signal(false);
}

describe("ToolbarButtonComponent", () => {
  let fixture: ComponentFixture<ToolbarButtonHostComponent>;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(ToolbarButtonHostComponent);
    fixture.detectChanges();
  });

  afterEach(async () => {
    await userEvent.unhover(document.body);
    AppearanceFixture.reset();
  });

  function button(selector: string = "button"): HTMLButtonElement {
    return fixture.nativeElement.querySelector(selector);
  }

  function set(update: (host: ToolbarButtonHostComponent) => void): void {
    update(fixture.componentInstance);
    fixture.detectChanges();
  }

  it("keeps a label too long for its row inside its own box, ending it with an ellipsis, so it never draws over the next button, in either direction", () => {
    for (const direction of ["ltr", "rtl"]) {
      const row = fixture.nativeElement.querySelector(`.row[data-direction="${direction}"]`) as HTMLElement;
      const long = row.querySelector(".long") as HTMLElement;
      const after = row.querySelector(".after") as HTMLElement;
      const label = long.querySelector("[data-truncates]") as HTMLElement;
      const [box, next, text] = [long, after, label].map(t => t.getBoundingClientRect()) as [DOMRect, DOMRect, DOMRect];

      expect(label.classList.contains("tr-toolbar-button-label")).toBe(true);
      expect(Math.min(box.right, next.right) - Math.max(box.left, next.left)).toBeLessThanOrEqual(0);
      expect(box.width).toBeLessThanOrEqual(row.getBoundingClientRect().width);
      expect([text.left >= box.left, text.right <= box.right]).toEqual([true, true]);
      expect([label.scrollWidth > label.clientWidth, getComputedStyle(label).textOverflow, getComputedStyle(label).whiteSpace]).toEqual([true, "ellipsis", "nowrap"]);
      for (const icon of [long.querySelector(".tr-toolbar-button-glyph"), long.querySelector(".tr-toolbar-button-chevron")] as HTMLElement[])
        AppearanceFixture.expectPixels(icon.getBoundingClientRect().width, parseFloat(getComputedStyle(icon).fontSize));
    }
  });

  it("shows only its glyph, named by its label, and the glyph is hidden from assistive technology", () => {
    expect(button().getAttribute("aria-label")).toBe("Bold");
    expect(button().classList.contains("tr-toolbar-button-icon-only")).toBe(true);
    expect(button().querySelector(".tr-toolbar-button-glyph")?.textContent).toBe("format_bold");
    expect(button().querySelector(".tr-toolbar-button-glyph")?.getAttribute("aria-hidden")).toBe("true");
    expect(button().querySelector(".tr-toolbar-button-label")).toBeNull();
    expect(button().querySelector(".tr-toolbar-button-chevron")).toBeNull();
  });

  it("shows its label when it has no glyph or is asked to show it, and a chevron and a popup when it opens a menu", () => {
    set(t => t.icon.set(null));
    expect(button().querySelector(".tr-toolbar-button-label")?.textContent).toBe("Bold");
    expect(button().classList.contains("tr-toolbar-button-icon-only")).toBe(false);

    set(t => {
      t.icon.set("format_bold");
      t.isShowingLabel.set(true);
      t.hasMenu.set(true);
    });
    expect([button().querySelector(".tr-toolbar-button-glyph")?.textContent, button().querySelector(".tr-toolbar-button-label")?.textContent]).toEqual(["format_bold", "Bold"]);
    expect(button().querySelector(".tr-toolbar-button-chevron")?.textContent).toBe("expand_more");
    expect(button().getAttribute("aria-haspopup")).toBe("menu");
  });

  for (const theme of AppearanceFixture.themes)
    it(`leaves the ${theme.id} theme's pill padding on both sides of its label, as a tab's pill does`, () => {
      AppearanceFixture.apply(theme);
      set(t => t.isShowingLabel.set(true));
      const style = getComputedStyle(button());

      AppearanceFixture.expectLook(style.paddingLeft, theme, "pill-padding", "padding-left");
      AppearanceFixture.expectLook(style.paddingRight, theme, "pill-padding", "padding-right");
    });

  it("exposes its pressed state and fills when pressed", () => {
    expect(button().hasAttribute("aria-pressed")).toBe(false);

    set(t => t.pressed.set(true));
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(getComputedStyle(button()).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    set(t => t.pressed.set(false));
    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(getComputedStyle(button()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("fills on hover, but not while unavailable, and stays focusable and clickable as a native button", async () => {
    await userEvent.hover(button());
    expect(getComputedStyle(button()).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    set(t => t.isUnavailable.set(true));
    expect(button().getAttribute("aria-disabled")).toBe("true");
    expect(button().disabled).toBe(false);
    expect(getComputedStyle(button()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(button()).opacity).toBe("0.5");

    set(t => t.isUnavailable.set(false));
    expect(button().hasAttribute("aria-disabled")).toBe(false);
  });
});
