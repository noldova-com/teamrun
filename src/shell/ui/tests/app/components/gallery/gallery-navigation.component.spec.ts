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

describe("GalleryNavigationComponent", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("lets the Gallery's tree be rearranged: Alt with an arrow key moves the focused row, and the tree shows the new order", async () => {
    fixture = await GalleryFixture.showAsync();
    const tree = fixture.nativeElement.querySelector("tr-gallery-navigation tr-tree") as HTMLElement;
    const labels = (): (string | null | undefined)[] => [...tree.querySelectorAll("[role=treeitem] .tr-tree-label")].map(t => t.textContent);
    const notes = [...tree.querySelectorAll<HTMLElement>("[role=treeitem]")].find(t => t.querySelector(".tr-tree-label")?.textContent === "Notes") as HTMLElement;
    const before = labels();

    notes.focus();
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await fixture.whenStable();

    expect([before.indexOf("Notes"), labels().indexOf("Notes")]).toEqual([3, 0]);
  });
});
