/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { type GalleryComponent } from "../../../../src/app/components/gallery/gallery.component";
import { ClipboardWriter } from "../../../../src/app/services/clipboard-writer";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import type { ClipboardWriterFixture } from "../../../fixtures/clipboard-writer.fixture";
import { GalleryFixture } from "../../../fixtures/gallery.fixture";

describe("GalleryContentComponent", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  function cell(caption: string): HTMLElement {
    return GalleryFixture.frames(fixture)[0]?.querySelector(`.tr-gallery-specimen[aria-label="Code block"] tr-gallery-cell[aria-label="${caption}"]`) as HTMLElement;
  }

  async function copyAsync(caption: string): Promise<HTMLElement> {
    const copy = cell(caption).querySelector(".tr-code-block-copy") as HTMLElement;
    copy.click();
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    return copy;
  }

  it("copies a code block's code through the window's clipboard, and a block in the Copy refused cell says Couldn't copy without writing", async () => {
    fixture = await GalleryFixture.showAsync();
    const clipboard = TestBed.inject(ClipboardWriter) as ClipboardWriterFixture;

    const copied = await copyAsync("Default");
    const refused = await copyAsync("Copy refused");

    expect([copied.getAttribute("aria-label"), refused.getAttribute("aria-label")]).toEqual(["Copied", "Couldn't copy"]);
    expect(clipboard.texts).toEqual([cell("Default").querySelector("code")?.textContent]);
  });

  it("shows a code block wrapped and one with its copy button focused", async () => {
    fixture = await GalleryFixture.showAsync();

    expect(cell("Word wrap on").querySelector(".tr-code-block-wrap")?.getAttribute("aria-pressed")).toBe("true");
    expect(cell("Focus").querySelector(".tr-code-block-copy")?.getAttribute("data-tr-state")).toBe("Focus");
  });
});
