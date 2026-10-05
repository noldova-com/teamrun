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

describe("GalleryOverlayContainer", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("opens the overlays of a scope inside it, so they take its theme and mode", async () => {
    fixture = await GalleryFixture.showAsync();
    const frame = GalleryFixture.frames(fixture)[3] as HTMLElement;

    (frame.querySelector(".tr-select-button") as HTMLButtonElement).click();
    await fixture.whenStable();
    const option = frame.querySelector(".cdk-overlay-container .tr-select-option") as HTMLElement;

    expect(option).not.toBeNull();
    expect(getComputedStyle(option).getPropertyValue("--tr-text")).toBe(getComputedStyle(frame).getPropertyValue("--tr-text"));
    expect(getComputedStyle(option).getPropertyValue("--tr-text")).not.toBe(getComputedStyle(document.body).getPropertyValue("--tr-text"));
    await userEvent.keyboard("{Escape}");
  });
});
