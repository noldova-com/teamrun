/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { GalleryComponent } from "../../src/app/components/gallery/gallery.component";
import { AppearanceFixture } from "./appearance.fixture";

export class GalleryFixture {
  public static async showAsync(): Promise<ComponentFixture<GalleryComponent>> {
    const fixture = TestBed.createComponent(GalleryComponent);
    fixture.componentRef.setInput("themes", AppearanceFixture.themes);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  public static frames(fixture: ComponentFixture<GalleryComponent>): readonly HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll(".tr-gallery-scope-frame")];
  }

  public static colorOf(parent: HTMLElement, property: string, value: string): string {
    const probe = document.createElement("span");
    probe.style.setProperty(property, value);
    parent.append(probe);
    const color = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return color;
  }
}
