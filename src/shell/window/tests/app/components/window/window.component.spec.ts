/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AppearanceService, DefaultTheme, ThemeMode, Typography } from "@noldova/teamrun-shell-ui";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { MenuCheck } from "../../../../src/app/enums/menu-check";
import { CommandRow } from "../../../../src/app/models/command-row";
import { MenuSection } from "../../../../src/app/models/menu-section";
import { Toolbar } from "../../../../src/app/models/toolbar";
import { LayoutStoreService } from "../../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { ToolbarService } from "../../../../src/app/services/toolbar.service";
import { WindowErrorHandler } from "../../../../src/app/services/window-error-handler";
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

    expect([...root.children].map(t => t.tagName.toLowerCase())).toEqual(["tr-window-row", "tr-toolbar-band", "tr-workspace", "tr-status-bar", "tr-toasts"]);
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
      titleBarHeight: AppearanceFixture.toPixels(2)
    }]);
  });

  for (const panelSize of [12, 13, 18])
    for (const platform of ["win32", "darwin"])
      for (const count of [0, 2])
        it(`stands the window row's controls, ${count} toolbar rows and the panels 0.25rem apart at panel size ${panelSize} on ${platform}`, async () => {
          const toolbar = new Toolbar("notes.main", "Main", [new MenuSection("notes.create", [new CommandRow("notes.newNote", {}, "New note", "note", null, true, MenuCheck.None, false)])]);
          const rows = Array.from({ length: count }, () => [toolbar]);
          DesktopBridgeFixture.install(platform);
          TestBed.configureTestingModule({ providers: [{ provide: ToolbarService, useValue: { rows: signal(rows), hasContent: signal(count > 0) } }] });
          AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
          TestBed.inject(AppearanceService).setTypography(new Typography(panelSize));
          const fixture = TestBed.createComponent(WindowComponent);
          await fixture.whenStable();
          const root: HTMLElement = fixture.nativeElement;
          const row = root.querySelector("tr-window-row") as HTMLElement;
          const controls = [...row.querySelectorAll<HTMLElement>("button")].filter(t => t.checkVisibility({ visibilityProperty: true })).map(t => t.getBoundingClientRect().bottom);
          const bands = [...root.querySelectorAll<HTMLElement>(".tr-toolbar-row")].map(t => t.getBoundingClientRect());
          const panel = (root.querySelector("tr-tab-group") as HTMLElement).getBoundingClientRect();
          const edges = [{ top: Number.NaN, bottom: Math.max(...controls) }, ...bands, { top: panel.top, bottom: Number.NaN }];
          const gaps = edges.slice(1).map((t, index) => t.top - (edges[index]?.bottom ?? Number.NaN));

          expect(gaps).toHaveLength(count + 1);
          for (const gap of gaps)
            AppearanceFixture.expectPixels(gap, AppearanceFixture.toPixels(0.25, panelSize));
        });

  it("shows the startup card instead of the workspace until the runtime is ready", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.startup = { kind: "PreShellData", details: ["/data/old"] };
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect([...root.children].map(t => t.tagName.toLowerCase())).toEqual(["tr-window-row", "tr-toolbar-band", "tr-startup", "tr-status-bar", "tr-toasts"]);
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect(root.querySelector("tr-workspace")).not.toBeNull();
    expect(root.querySelector("tr-startup")).toBeNull();
  });

  it("keeps the workspace under the startup card while the runtime starts again", async () => {
    const bridge = DesktopBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const workspace = root.querySelector("tr-workspace");

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await fixture.whenStable();
    const card = root.querySelector("tr-startup") as HTMLElement;
    const tags = [...root.children].map(t => t.tagName.toLowerCase());
    const [cardBox, workspaceBox] = [card, workspace as Element].map(t => t.getBoundingClientRect().toJSON());
    const announced = [card.querySelector("[role=status]")?.textContent?.trim(), card.classList.contains("tr-window-reconnecting")];
    bridge.publishStartup({ kind: "Ready", details: [] });
    await fixture.whenStable();

    expect(tags).toEqual(["tr-window-row", "tr-toolbar-band", "tr-workspace", "tr-startup", "tr-status-bar", "tr-toasts"]);
    expect(cardBox).toEqual(workspaceBox);
    expect(announced).toEqual(["Starting TeamRun…", true]);
    expect(root.querySelector("tr-workspace")).toBe(workspace);
    expect(root.querySelector("tr-startup")).toBeNull();
  });

  it("answers close requests as saved and stops listening when destroyed", async () => {
    const bridge = DesktopBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();

    bridge.requestClose("request");
    await vi.waitFor(() => expect(bridge.answers).toEqual(["request:true"]));
    fixture.destroy();

    expect(bridge.layout).toBeNull();
    expect(bridge.closeListenerCount).toBe(0);
  });

  it("saves a changed layout before it answers a close request", async () => {
    const bridge = DesktopBridgeFixture.install();
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const layout = TestBed.inject(LayoutService);
    await vi.waitFor(() => expect(bridge.layout).toBeNull());
    await layout.loadAsync();
    layout.toggleDock(DockSide.Left);

    bridge.requestClose("request");

    await vi.waitFor(() => expect(bridge.answers).toEqual(["request:true"]));
    expect(bridge.layout).toEqual(layout.layout().toJson());
    fixture.destroy();
  });

  it("writes a failed layout save to the desktop's log and still lets TeamRun close", async () => {
    const bridge = DesktopBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useClass: WindowErrorHandler }] });
    const fixture = TestBed.createComponent(WindowComponent);
    await fixture.whenStable();
    const layout = TestBed.inject(LayoutService);
    await layout.loadAsync();
    layout.toggleDock(DockSide.Left);
    const failure = new Error("This device has no identity, so the window's layout is not kept.");
    vi.spyOn(TestBed.inject(LayoutStoreService), "writeAsync").mockRejectedValue(failure);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    bridge.requestClose("request");

    await vi.waitFor(() => expect(bridge.answers).toEqual(["request:true"]));
    expect(bridge.errorsLogged).toEqual([[null, failure.stack]]);
    fixture.destroy();
  });
});
