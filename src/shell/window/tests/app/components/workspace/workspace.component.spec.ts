/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { WorkspaceComponent } from "../../../../src/app/components/workspace/workspace.component";
import { Layout } from "../../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

@Component({
  imports: [WorkspaceComponent],
  template: `<tr-workspace [style.width.px]="width()" [style.height.px]="height()" [layout]="layout" [registry]="registry" />`
})
class WorkspaceHostComponent {
  public readonly width = signal(1000);
  public readonly height = signal(600);
  public registry: ViewRegistry = ViewRegistry.createEmpty();
  public layout: Layout = Layout.createDefault(this.registry);
}

describe("WorkspaceComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  async function renderAsync(registry: ViewRegistry): Promise<ComponentFixture<WorkspaceHostComponent>> {
    AppearanceFixture.apply();
    const fixture = TestBed.createComponent(WorkspaceHostComponent);
    fixture.componentInstance.registry = registry;
    fixture.componentInstance.layout = Layout.createDefault(registry);
    await settleAsync(fixture);
    return fixture;
  }

  async function settleAsync(fixture: ComponentFixture<WorkspaceHostComponent>): Promise<void> {
    fixture.detectChanges();
    await new Promise(t => requestAnimationFrame(() => requestAnimationFrame(t)));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function groupsOf(fixture: ComponentFixture<WorkspaceHostComponent>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>("tr-panel-card")];
  }

  function boundsOf(element: HTMLElement): readonly number[] {
    const workspace = element.closest("tr-workspace")?.getBoundingClientRect() ?? new DOMRect();
    const bounds = element.getBoundingClientRect();
    return [bounds.x - workspace.x, bounds.y - workspace.y, bounds.width, bounds.height];
  }

  it("shows only the middle, with the empty-window card, when there are no modules", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const groups = groupsOf(fixture);
    const margin = AppearanceFixture.toPixels(0.25);

    expect(groups.length).toBe(1);
    expect(groups[0]?.classList.contains("tr-panel-card-shell")).toBe(false);
    expect(groups[0]?.querySelector("tr-empty-window")).not.toBeNull();
    const [x, y, width, height] = boundsOf(groups[0] ?? fixture.nativeElement);
    AppearanceFixture.expectPixels(x ?? 0, margin);
    AppearanceFixture.expectPixels(y ?? 0, 0);
    AppearanceFixture.expectPixels(width ?? 0, 1000 - 2 * margin);
    AppearanceFixture.expectPixels(height ?? 0, 600 - margin);
  });

  it("follows the size of its region", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());

    fixture.componentInstance.width.set(800);
    fixture.componentInstance.height.set(500);
    await settleAsync(fixture);

    const [, , width, height] = boundsOf(groupsOf(fixture)[0] ?? fixture.nativeElement);
    AppearanceFixture.expectPixels(width ?? 0, 800 - 2 * AppearanceFixture.toPixels(0.25));
    AppearanceFixture.expectPixels(height ?? 0, 500 - AppearanceFixture.toPixels(0.25));
  });

  it("shows docked groups on the shell surface and leaves the documents without the empty-window card", async () => {
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const groups = groupsOf(fixture);
    const docked = groups.filter(t => t.classList.contains("tr-panel-card-shell"));

    expect(docked.length).toBe(groups.length - 1);
    expect(docked.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector("tr-empty-window")).toBeNull();
    expect(getComputedStyle(docked[0] ?? fixture.nativeElement).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "sideBar.background"));
  });
});
