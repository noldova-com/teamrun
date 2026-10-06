/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ConfigurationTableHostComponent } from "../../../fixtures/configuration-table-host.component";

describe("ConfigurationTableFillDirective", () => {
  it("marks the header and the cells of the column that takes the rest of the width", async () => {
    const fixture = TestBed.createComponent(ConfigurationTableHostComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect([...element.querySelectorAll(".tr-configuration-table-fill")].map(t => t.textContent?.slice(0, 4))).toEqual(["Valu", "code", "A va"]);
  });
});
