/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture } from "@angular/core/testing";

import { type GalleryComponent } from "../../../../src/app/components/gallery/gallery.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

describe("GalleryResources", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("names each scope by its theme and mode, and a specimen's focus button by the specimen", async () => {
    fixture = await GalleryFixture.showAsync();
    const frame = GalleryFixture.frames(fixture)[1] as HTMLElement;

    expect(frame.getAttribute("aria-label")).toBe("Default, dark mode");
    expect(frame.querySelector(".tr-gallery-specimen[aria-label='Checkbox'] .tr-gallery-specimen-focus")?.getAttribute("aria-label")).toBe("Show the keyboard focus on the Checkbox");
  });
});
