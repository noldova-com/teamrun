/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, inject } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { SplitSashComponent } from "../../../../src/app/components/split-sash/split-sash.component";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { SplitHandle } from "../../../../src/app/models/layout/split-handle";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";

@Component({
  imports: [SplitSashComponent],
  template: `
    @for (handle of handles(); track handle.split.id + "/" + handle.index) {
      <tr-split-sash [handle]="handle" />
    }
  `
})
class SplitSashHostComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  public readonly handles: Signal<readonly SplitHandle[]> = computed(() => this.layout.geometry().handles);
}

describe("SplitSashComponent", () => {
  beforeEach(() => {
    DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  let fixture: ComponentFixture<SplitSashHostComponent>;
  let layout: LayoutService;

  async function renderAsync(edge: PanelEdge): Promise<void> {
    const split = Layout.createDefault(registry).openView(LayoutFixture.search, registry).splitGroup(LayoutFixture.search, 1, edge);
    layout = await LayoutServiceFixture.prepareAsync(registry, split, 160, 80);
    fixture = TestBed.createComponent(SplitSashHostComponent);
    fixture.detectChanges();
  }

  function sash(): HTMLElement {
    const found = fixture.nativeElement.querySelector("tr-sash");
    if (Object.isNull(found))
      throw new Error("No sash is shown.");
    return found;
  }

  function press(key: string): void {
    sash().dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
    fixture.detectChanges();
  }

  it("places a labelled vertical sash between groups side by side and resizes the leading group", async () => {
    await renderAsync(PanelEdge.Right);
    const handle = layout.geometry().handles[0];
    const host: HTMLElement = fixture.nativeElement.querySelector("tr-split-sash");

    expect(host.style.left).toBe(`${handle?.bounds.x}rem`);
    expect(host.style.width).toBe(`${handle?.bounds.width}rem`);
    expect(sash().getAttribute("aria-label")).toBe("Resize the pane on the left");
    expect([sash().getAttribute("aria-valuemin"), sash().getAttribute("aria-valuemax")])
      .toEqual([String(Math.round((handle?.minimumLength ?? 0) * 16)), String(Math.round((handle?.maximumLength ?? 0) * 16))]);
    expect(sash().getAttribute("aria-orientation")).toBe("vertical");
    expect(sash().getAttribute("aria-valuenow")).toBe(String(Math.round((handle?.leadingLength ?? 0) * 16)));

    press("ArrowRight");

    expect(layout.geometry().handles[0]?.leadingLength).toBeCloseTo((handle?.leadingLength ?? 0) + 0.5);
  });

  it("places a horizontal sash between stacked groups", async () => {
    await renderAsync(PanelEdge.Bottom);
    const before = layout.geometry().handles[0]?.leadingLength ?? 0;

    expect(sash().getAttribute("aria-orientation")).toBe("horizontal");
    expect(sash().getAttribute("aria-label")).toBe("Resize the pane above");
    press("ArrowUp");

    expect(layout.geometry().handles[0]?.leadingLength).toBeCloseTo(before - 0.5);
  });
});
