/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { GalleryStateDirective } from "../../../../src/app/components/gallery/gallery-state.directive";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";
import { MotionFixture } from "../../../fixtures/motion.fixture";

@Component({
  imports: [GalleryStateDirective],
  template: `
    <span class="hovered" trGalleryHover></span>
    <div class="hovered-part" trGalleryHover=".part"><span class="part"></span></div>
    <span class="focused" trGalleryFocus></span>
    <div class="focused-part" trGalleryFocus=".part"><span class="part"></span></div>
    <span class="plain"></span>
  `
})
class StateHostComponent {
}

@Component({
  imports: [GalleryStateDirective],
  template: `<div trGalleryFocus=".missing"></div>`
})
class MissingPartHostComponent {
}

describe("GalleryStateDirective", () => {
  const properties: readonly string[] = ["background-color", "color", "border-top-color", "outline-style", "outline-color", "outline-offset", "opacity", "visibility"];
  const look = (element: Element): string[] => [element, ...element.querySelectorAll("*")]
    .flatMap(t => [null, "::before", "::after"].map(pseudo => properties.map(p => getComputedStyle(t, pseudo).getPropertyValue(p)).join(" ")));
  const name = (element: Element): string => `${element.closest(".tr-gallery-specimen")?.getAttribute("aria-label") ?? ""} / ${element.closest("tr-gallery-cell")?.getAttribute("aria-label") ?? ""}`;

  afterEach(async () => {
    AppearanceFixture.reset();
    await MotionFixture.resetAsync();
  });

  const renderAsync = async (host: Type<unknown>): Promise<HTMLElement> => {
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it("marks its host as hovered or focused, or the part its selector finds", async () => {
    const element = await renderAsync(StateHostComponent);
    const state = (selector: string): string | null => (element.querySelector(selector) as HTMLElement).getAttribute("data-tr-state");

    expect([state(".hovered"), state(".hovered-part"), state(".hovered-part .part")]).toEqual(["Hover", null, "Hover"]);
    expect([state(".focused"), state(".focused-part"), state(".focused-part .part"), state(".plain")]).toEqual(["Focus", null, "Focus", null]);
  });

  it("fails when the part its selector names is missing, instead of showing the default look", async () => {
    await expect(renderAsync(MissingPartHostComponent)).rejects.toThrow("The Gallery cell has no part that matches .missing.");
  });

  it("shows in each of the Gallery's Hover cells the look its control has when the pointer is really over it", async () => {
    await MotionFixture.reduceAsync();
    const fixture = await GalleryFixture.showAsync();
    const frame = GalleryFixture.frames(fixture)[0] as HTMLElement;
    const marked = [...frame.querySelectorAll<HTMLElement>("[data-tr-state='Hover']")];

    expect(marked.map(t => name(t))).toEqual(["Button / Hover", "Button / Secondary, hover", "Icon button / Hover", "Choice pills / Hover", "Tab / Hover", "Toolbar button / Hover",
      "Menu / Rows", "Menu / Menu bar, hover"]);
    for (const element of marked) {
      const shown = look(element);
      element.removeAttribute("data-tr-state");
      await userEvent.unhover(document.body);
      const plain = look(element);
      await userEvent.hover(element);
      const real = look(element);
      await userEvent.unhover(document.body);
      element.setAttribute("data-tr-state", "Hover");

      expect([name(element), shown]).toEqual([name(element), real]);
      expect([name(element), shown]).not.toEqual([name(element), plain]);
    }
  });

  it("shows in each of the Gallery's Focus cells the look its control has when it really holds the keyboard focus", async () => {
    await MotionFixture.reduceAsync();
    const fixture = await GalleryFixture.showAsync();
    const frame = GalleryFixture.frames(fixture)[0] as HTMLElement;
    const marked = [...frame.querySelectorAll<HTMLElement>("[data-tr-state='Focus']")];

    expect(marked.map(t => name(t))).toEqual(["Button / Focus", "Icon button / Focus", "Checkbox / Focus", "Text field / Focus", "Select / Focus", "Choice pills / Focus", "Tab / Focus",
      "Toolbar button / Focus", "Sash / Focus"]);
    await userEvent.unhover(document.body);
    for (const element of marked) {
      const shown = look(element);
      element.removeAttribute("data-tr-state");
      const plain = look(element);
      await userEvent.keyboard("{Shift}");
      element.focus();
      const real = look(element);
      element.blur();
      element.setAttribute("data-tr-state", "Focus");

      expect([name(element), shown]).toEqual([name(element), real]);
      expect([name(element), shown]).not.toEqual([name(element), plain]);
    }
  });
});
