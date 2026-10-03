/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { AppearanceService, DefaultTheme, ModePreference, type Theme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { WindowRowComponent } from "../../../../src/app/components/window-row/window-row.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import { TopBarAction } from "../../../../src/app/models/top-bar-action";
import { TopBarActionContribution } from "../../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../../src/app/models/top-bar-action-state";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { BarItemsService } from "../../../../src/app/services/bar-items.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { MenuService } from "../../../../src/app/services/menu.service";
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

  function useNotesMenus(runs: JsonValue[]): void {
    TestBed.configureTestingModule({
      providers: [{
        provide: WindowPartTokens.menus, useValue: [MenuDeclarations.fromJson("notes", {
          places: [], groups: [{ name: "notes.create", place: "shell.file", exclusive: false, items: [{ command: "notes.newNote", arguments: { template: "plan" } }] }]
        })]
      }]
    });
    TestBed.inject(CommandService).setCommands([new CommandContribution("notes.newNote", "New note", null, null, async t => {
      runs.push(t);
      return null;
    })]);
    TestBed.inject(MenuService).setActiveModules(["notes"]);
  }

  it("opens the menu bar's places from a menu button at the row's start on Windows and Linux, outside the drag region", async () => {
    const runs: JsonValue[] = [];
    DesktopBridgeFixture.install("win32");
    useNotesMenus(runs);
    apply();

    const row = render();
    const button = row.firstElementChild as HTMLButtonElement;
    button.click();
    const list = document.querySelector("tr-menu.tr-window-row-menu-list") as HTMLElement;
    const places = [...list.querySelectorAll<HTMLButtonElement>("button.tr-window-row-menu-place")];
    places[0]?.click();
    (document.querySelector("tr-menu[data-place='shell.file'] button[data-command='notes.newNote']") as HTMLButtonElement).click();
    await Promise.resolve();

    expect([button.classList.contains("tr-window-row-menu"), button.getAttribute("aria-label"), getComputedStyle(button).getPropertyValue("app-region")]).toEqual([true, "Menu", "no-drag"]);
    expect(places.map(t => t.getAttribute("data-place"))).toEqual(["shell.file", "shell.view"]);
    expect(runs).toEqual([{ template: "plan" }]);
  });

  it("has no menu button on macOS, sends the menu bar to the desktop and runs the row the desktop reports until it is removed", async () => {
    const runs: JsonValue[] = [];
    const bridge = DesktopBridgeFixture.install("darwin");
    useNotesMenus(runs);
    apply();
    const listeners = bridge.listenerCount;
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();

    bridge.chooseMenuCommand("shell.file/notes.create/0");
    await Promise.resolve();
    fixture.destroy();

    expect(fixture.nativeElement.querySelector(".tr-window-row-menu")).toBeNull();
    expect(JsonReader.fromValue(bridge.menuBars.at(-1) ?? {}).readObjectArray("menus").map(t => t.readString("place")))
      .toEqual(["shell.app", "shell.file", "shell.edit", "shell.view", "shell.window", "shell.help"]);
    expect(runs).toEqual([{ template: "plan" }]);
    expect(bridge.listenerCount).toBe(listeners);
  });
});
