/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ConfigurationTableHostComponent } from "../../../fixtures/configuration-table-host.component";

describe("ConfigurationTableDirective", () => {
  let fixture: ComponentFixture<ConfigurationTableHostComponent>;

  async function renderAsync(): Promise<void> {
    fixture = TestBed.createComponent(ConfigurationTableHostComponent);
    await fixture.whenStable();
  }

  async function changeAsync(change: (host: ConfigurationTableHostComponent) => void): Promise<void> {
    change(fixture.componentInstance);
    await fixture.whenStable();
  }

  const find = (selector: string): HTMLElement => fixture.nativeElement.querySelector(selector);

  it("marks the owner's table as the configuration table's grid, named by the heading", async () => {
    await renderAsync();

    expect([find("table").classList.contains("tr-configuration-table-grid"), find("table").getAttribute("aria-label")]).toEqual([true, "Environment variables"]);
  });

  it("names the table with its label when it has no heading, and leaves it unnamed without either", async () => {
    await renderAsync();
    await changeAsync(t => {
      t.heading.set("");
      t.label.set("Variables");
    });

    expect([find(".tr-configuration-table-heading"), find("table").getAttribute("aria-label")]).toEqual([null, "Variables"]);

    await changeAsync(t => t.label.set(""));

    expect(find("table").hasAttribute("aria-label")).toBe(false);
  });
});
