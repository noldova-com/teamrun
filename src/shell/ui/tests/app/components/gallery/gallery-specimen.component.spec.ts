/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { type GalleryComponent } from "../../../../src/app/components/gallery/gallery.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

describe("GallerySpecimenComponent", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("shows the keyboard focus on the first control of a specimen when its button is pressed from the keyboard, and not before", async () => {
    fixture = await GalleryFixture.showAsync();
    const checkbox = (GalleryFixture.frames(fixture)[2] as HTMLElement).querySelector<HTMLElement>(".tr-gallery-specimen[aria-label=\"Checkbox\"]") as HTMLElement;
    const button = checkbox.querySelector<HTMLButtonElement>(".tr-gallery-specimen-focus") as HTMLButtonElement;
    const input = checkbox.querySelector("input") as HTMLInputElement;

    expect(document.activeElement).not.toBe(input);
    expect(button.getAttribute("aria-label")).toBe("Show the keyboard focus on the Checkbox");
    button.focus();
    await userEvent.keyboard("{Enter}");

    expect(document.activeElement).toBe(input);
    expect(input.matches(":focus-visible")).toBe(true);
  });

  it("offers the focus button on every specimen that has a control to focus, and on no other", async () => {
    fixture = await GalleryFixture.showAsync();
    const specimens = [...(GalleryFixture.frames(fixture)[0] as HTMLElement).querySelectorAll<HTMLElement>(".tr-gallery-specimen")];

    const offered = specimens.filter(t => t.querySelector(".tr-gallery-specimen-focus") !== null).map(t => t.getAttribute("aria-label"));
    const without = specimens.filter(t => t.querySelector(".tr-gallery-specimen-focus") === null).map(t => t.getAttribute("aria-label"));

    expect(offered).toEqual(expect.arrayContaining(["Button", "Icon button", "Checkbox", "Text field", "Select", "Tab", "Tree", "Toolbar", "Toolbar button", "Menu"]));
    expect(without).toEqual(expect.arrayContaining(["Progress", "View badge"]));
  });
});
