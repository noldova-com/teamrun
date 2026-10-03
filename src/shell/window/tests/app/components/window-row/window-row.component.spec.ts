/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { AppearanceService, DefaultTheme, ModePreference, type Theme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { WindowRowComponent } from "../../../../src/app/components/window-row/window-row.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { TopBarAction } from "../../../../src/app/models/top-bar-action";
import { TopBarActionContribution } from "../../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../../src/app/models/top-bar-action-state";
import { BarItemsService } from "../../../../src/app/services/bar-items.service";
import { CommandSearchService } from "../../../../src/app/services/command-search.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { FixtureTheme } from "../../../../../ui/tests/fixtures/fixture-theme";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("WindowRowComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  function apply(theme: Theme = DefaultTheme.theme, mode: ThemeMode = ThemeMode.Light): void {
    AppearanceFixture.apply(theme, mode);
    const appearance = TestBed.inject(AppearanceService);
    appearance.setTheme(theme);
    appearance.setModePreference(mode === ThemeMode.Dark ? ModePreference.Dark : ModePreference.Light);
  }

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and height from the ${theme.id} theme in ${mode} mode`, () => {
        DesktopBridgeFixture.install();
        apply(theme, mode);

        const style = getComputedStyle(render());

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "titleBar.activeBackground"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "titleBar.activeForeground"));
        AppearanceFixture.expectLook(style.height, theme, "window-row-height", "height");
      });

  it("shows the modules' top bar actions in order as icon buttons that run their commands, outside the drag region", async () => {
    const runs: JsonValue[] = [];
    const errors: unknown[] = [];
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    DesktopBridgeFixture.install("win32");
    apply();
    const action = (name: string, state: TopBarActionState): TopBarAction => new TopBarAction(new TopBarActionContribution(name, state), () => undefined);
    const compose = action("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote", { commandArguments: { title: "Plan" } }));
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("notes.newNote", "New note", null, null, async t => {
        runs.push(t);
        return null;
      }),
      new CommandContribution("notes.fail", "Fail", null, null, () => Promise.reject(new Error("The note was not created.")))
    ]);
    TestBed.inject(BarItemsService).set([], [
      compose,
      action("notes.print", new TopBarActionState("print", "Print", "notes.print")),
      action("notes.share", new TopBarActionState("share", "Share", "notes.newNote", { isHidden: true })),
      action("notes.broken", new TopBarActionState("error", "Broken", "notes.fail"))
    ]);

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = [...fixture.nativeElement.querySelectorAll("button.tr-window-row-action")];
    buttons[0]?.click();
    buttons[2]?.click();
    await fixture.whenStable();

    expect(buttons.map(t => [t.getAttribute("data-tr-item"), t.getAttribute("aria-label"), t.disabled])).toEqual([
      ["notes.compose", "New note", false], ["notes.print", "Print", true], ["notes.broken", "Broken", false]
    ]);
    expect(getComputedStyle(buttons[0] ?? fixture.nativeElement).getPropertyValue("app-region")).toBe("no-drag");
    expect(runs).toEqual([{ title: "Plan" }]);
    expect(errors.map(t => String(t))).toEqual(["Error: The note was not created."]);
  });

  it("ends the top bar with the shell's command search, outside the drag region", async () => {
    DesktopBridgeFixture.install("win32");
    apply();
    const open = vi.spyOn(TestBed.inject(CommandSearchService), "open").mockImplementation(() => undefined);
    TestBed.inject(BarItemsService).set([], [new TopBarAction(new TopBarActionContribution("notes.print", new TopBarActionState("print", "Print", "notes.print")), () => undefined)]);

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = [...fixture.nativeElement.querySelectorAll(".tr-window-row-actions button")];
    buttons.at(-1)?.click();
    await fixture.whenStable();

    expect(buttons.map(t => t.getAttribute("aria-label"))).toEqual(["Print", "Search commands"]);
    expect(getComputedStyle(buttons.at(-1) ?? fixture.nativeElement).getPropertyValue("app-region")).toBe("no-drag");
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("is a drag region that leaves the native controls' space free on Windows and Linux", () => {
    DesktopBridgeFixture.install("win32");
    apply();

    const row = render();
    const style = getComputedStyle(row);

    expect(row.classList.contains("tr-window-row-mac")).toBe(false);
    expect(row.getAttribute("data-tr-chrome")).toBe("top");
    expect(style.getPropertyValue("app-region")).toBe("drag");
    expect(style.paddingLeft).toBe("0px");
    expect(style.paddingRight).toBe("0px");
  });

  it("reports its painted colors and height once after the first render", async () => {
    const bridge = DesktopBridgeFixture.install();
    apply(DefaultTheme.theme, ThemeMode.Dark);

    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(bridge.appearances).toEqual([{
      background: getComputedStyle(document.body).backgroundColor,
      titleBar: AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Dark, "titleBar.activeBackground"),
      titleBarText: AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Dark, "titleBar.activeForeground"),
      titleBarHeight: Math.round(AppearanceFixture.toPixels(2.1875))
    }]);
  });

  it("reports its colors again whenever the mode or the theme changes, and not before the first report", async () => {
    const bridge = DesktopBridgeFixture.install();
    const appearance = TestBed.inject(AppearanceService);
    appearance.setModePreference(ModePreference.Light);
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();
    const [light] = bridge.appearances;

    appearance.setModePreference(ModePreference.Dark);
    await fixture.whenStable();
    appearance.setTheme(FixtureTheme.theme);
    await fixture.whenStable();
    appearance.setModePreference(ModePreference.Dark);
    await fixture.whenStable();

    expect(bridge.appearances.length).toBe(1);
    expect(bridge.changes.length).toBe(2);
    expect(bridge.changes[0]?.["titleBar"]).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Dark, "titleBar.activeBackground"));
    expect(bridge.changes[0]?.["titleBar"]).not.toBe(light?.["titleBar"]);
    expect(bridge.changes[1]?.["titleBar"]).toBe(AppearanceFixture.readColor(FixtureTheme.theme, ThemeMode.Dark, "titleBar.activeBackground"));
  });

  it("leaves the traffic lights' space free on macOS", () => {
    DesktopBridgeFixture.install("darwin");
    apply();

    const row = render();

    expect(row.classList.contains("tr-window-row-mac")).toBe(true);
    expect(getComputedStyle(row).paddingLeft).toBe("78px");
  });
});
