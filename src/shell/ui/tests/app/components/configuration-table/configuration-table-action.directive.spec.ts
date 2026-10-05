/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ConfigurationTableHostComponent } from "../../../fixtures/configuration-table-host.component";

describe("ConfigurationTableActionDirective", () => {
  it("places the content it marks in the heading's row and leaves the rest to the table's place", async () => {
    const fixture = TestBed.createComponent(ConfigurationTableHostComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect([element.querySelector(".tr-configuration-table-actions")?.contains(element.querySelector(".add")), element.querySelector(".tr-configuration-table-scroll")?.contains(element.querySelector("table"))])
      .toEqual([true, true]);
  });
});
