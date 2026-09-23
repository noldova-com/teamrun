/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { DockSide } from "../../../src/app/enums/dock-side";
import { Resources } from "../../../src/app/resources";
import { LayoutService } from "../../../src/app/services/layout.service";
import { ShellService } from "../../../src/app/services/shell.service";
import { ViewportService } from "../../../src/app/services/viewport.service";

const resize = (width: number, height: number): void => {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.dispatchEvent(new Event(Resources.resizeEvent));
};

describe("ShellService", () => {
  it("binds the fitted tracks, follows the window, and caps what a sash may take", () => {
    MemoryStorage.install(window);
    resize(1920, 1080);
    const viewport = TestBed.inject(ViewportService);
    const shell = TestBed.inject(ShellService);
    const layout = TestBed.inject(LayoutService);
    const gap = Resources.shellGap;

    expect(viewport.width()).toBe(1920);
    expect(viewport.height()).toBe(1080);
    expect(shell.columns()).toBe(`${Resources.defaultDockSizes.Left + gap}px minmax(0, 1fr) ${Resources.defaultDockSizes.Right + gap}px`);
    expect(shell.rows()).toBe(`minmax(0, 1fr) ${Resources.dockStripSize + gap}px`);
    expect(shell.maximumSize(DockSide.Left)).toBe(Resources.dockMaximumSize - gap);

    resize(1000, 700);
    const across = shell.across();
    expect(across.document).toBe(Resources.documentMinimumSize);
    expect(across.track(DockSide.Right)).toBe(Resources.defaultDockSizes.Right + gap);
    expect(across.track(DockSide.Left)).toBe(1000 - Resources.shellPadding * 2 - across.track(DockSide.Right) - Resources.documentMinimumSize);
    expect(shell.columns()).toBe(`${across.track(DockSide.Left)}px minmax(0, 1fr) ${across.track(DockSide.Right)}px`);
    expect(shell.maximumSize(DockSide.Left)).toBe(across.track(DockSide.Left) - gap);

    resize(1920, 1080);
    expect(shell.columns()).toBe(`${Resources.defaultDockSizes.Left + gap}px minmax(0, 1fr) ${Resources.defaultDockSizes.Right + gap}px`);

    layout.resizeDock(DockSide.Right, 800);
    expect(shell.across().track(DockSide.Right)).toBe(800 + gap);
    resize(1200, 1080);
    expect(shell.across().track(DockSide.Right)).toBe(800 + gap);
    expect(shell.across().track(DockSide.Left)).toBe(1200 - Resources.shellPadding * 2 - (800 + gap) - Resources.documentMinimumSize);
    expect(shell.across().document).toBe(Resources.documentMinimumSize);
  });
});
