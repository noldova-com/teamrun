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

describe("GalleryOverlaysComponent", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("lets the checkbox row of a menu be used", async () => {
    fixture = await GalleryFixture.showAsync();
    const row = GalleryFixture.frames(fixture)[0]?.querySelector("tr-gallery-overlays [role='menuitemcheckbox']") as HTMLElement;

    row.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(row.getAttribute("aria-checked")).toBe("false");
  });

  it("marks the first match of the quick input's query in each of its options", async () => {
    fixture = await GalleryFixture.showAsync();
    const quick = fixture.nativeElement.querySelector("tr-gallery-overlays tr-quick-input") as HTMLElement;
    const query = (quick.querySelector(".tr-quick-input-field") as HTMLInputElement).value;
    const titles = [...quick.querySelectorAll<HTMLElement>(".tr-quick-input-title")].map(t => [...t.children]);
    const marked = titles.map(segments => {
      let offset = 0;
      return segments.flatMap(t => {
        const start = offset;
        offset += (t.textContent ?? "").length;
        return t.tagName === "MARK" ? [[start, t.textContent]] : [];
      });
    });

    expect(query).not.toBe("");
    expect(titles).toHaveLength(3);
    expect(marked).toEqual(titles.map(segments => {
      const text = segments.map(t => t.textContent).join("");
      const start = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
      return [[start, text.slice(start, start + query.length)]];
    }));
  });

  it("gives each sample dialog in every scope its own title id", async () => {
    fixture = await GalleryFixture.showAsync();
    const ids = [...fixture.nativeElement.querySelectorAll("tr-gallery-overlays .tr-dialog-title")].map(t => (t as HTMLElement).id);

    expect(ids).toHaveLength(GalleryFixture.frames(fixture).length * 2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(t => t.startsWith("tr-gallery-dialog-"))).toBe(true);
  });
});
