/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { LayoutStoreService } from "../../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { WindowComponent } from "../../../../src/app/components/window/window.component";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("WindowComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  it("stacks the window row, the workspace and the status bar over the whole window", async () => {
    DesktopBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect([...root.children].map(t => t.tagName.toLowerCase())).toEqual(["tr-window-row", "tr-workspace", "tr-status-bar"]);
    expect(root.getBoundingClientRect().height).toBe(innerHeight);
    expect(root.querySelector("tr-empty-window")).not.toBeNull();
  });

  it("applies the default theme and reports the painted appearance once after the first render", async () => {
    const bridge = DesktopBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const theme = DefaultTheme.theme;
    const mode = matchMedia("(prefers-color-scheme: dark)").matches ? ThemeMode.Dark : ThemeMode.Light;

    expect(bridge.appearances).toEqual([{
      background: AppearanceFixture.readColor(theme, mode, "sideBar.background"),
      titleBar: AppearanceFixture.readColor(theme, mode, "titleBar.activeBackground"),
      titleBarText: AppearanceFixture.readColor(theme, mode, "titleBar.activeForeground"),
      titleBarHeight: 35
    }]);
  });

  it("shows the startup card instead of the workspace until the runtime is ready", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.startup = { kind: "PreShellData", details: ["/data/old"] };
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect([...root.children].map(t => t.tagName.toLowerCase())).toEqual(["tr-window-row", "tr-startup", "tr-status-bar"]);
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect(root.querySelector("tr-workspace")).not.toBeNull();
    expect(root.querySelector("tr-startup")).toBeNull();
  });

  it("answers close requests as saved and stops listening when destroyed", async () => {
    const bridge = DesktopBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();

    bridge.requestClose("request");
    await vi.waitFor(() => expect(bridge.answers).toEqual(["request:true"]));
    expect(await TestBed.inject(LayoutStoreService).readAsync()).toEqual(TestBed.inject(LayoutService).layout().toJson());
    fixture.destroy();

    expect(bridge.closeListenerCount).toBe(0);
  });
});
