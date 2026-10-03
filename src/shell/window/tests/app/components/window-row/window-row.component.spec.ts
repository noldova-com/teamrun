/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { AppearanceService, DefaultTheme, ModePreference, type Theme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { WindowRowComponent } from "../../../../src/app/components/window-row/window-row.component";
import { TopBarSide } from "../../../../src/app/enums/top-bar-side";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import { TopBarAction } from "../../../../src/app/models/top-bar-action";
import { TopBarActionContribution } from "../../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../../src/app/models/top-bar-action-state";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { BarItemsService } from "../../../../src/app/services/bar-items.service";
import { CommandSearchService } from "../../../../src/app/services/command-search.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { MenuService } from "../../../../src/app/services/menu.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
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

  function useMenuBarStyle(style: string): void {
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: { values: signal(new Map([["shell.menuBar", style]])) } }] });
  }

  async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  }

  function press(target: EventTarget, key: string, type: "keydown" | "keyup" = "keydown", init: KeyboardEventInit = {}): void {
    const keyCode = ({ ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Escape: 27 } as Record<string, number>)[key] ?? 0;
    target.dispatchEvent(new KeyboardEvent(type, { key, keyCode, bubbles: true, cancelable: true, ...init }));
  }

  it("opens the menu bar's places from a menu button at the row's start on Windows and Linux, outside the drag region", async () => {
    const runs: JsonValue[] = [];
    DesktopBridgeFixture.install("win32");
    useMenuBarStyle("Button");
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
    expect(places.map(t => t.getAttribute("data-place"))).toEqual(["shell.file", "shell.edit", "shell.view"]);
    expect(runs).toEqual([{ template: "plan" }]);
  });

  it("shows the places as a menu bar of items that open their menus below them and run their rows, outside the drag region", async () => {
    const runs: JsonValue[] = [];
    DesktopBridgeFixture.install("win32");
    useNotesMenus(runs);
    apply();

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const row: HTMLElement = fixture.nativeElement;
    const bar = row.querySelector("tr-menu-bar") as HTMLElement;
    const items = [...bar.querySelectorAll<HTMLButtonElement>("button.tr-window-row-menu-bar-item")];
    items[0]?.click();
    await fixture.whenStable();
    const menu = document.querySelector("tr-menu[data-place='shell.file']") as HTMLElement;
    (menu.querySelector("button[data-command='notes.newNote']") as HTMLButtonElement).click();
    await Promise.resolve();

    expect([bar.getAttribute("role"), bar.getAttribute("aria-label"), getComputedStyle(bar).getPropertyValue("app-region")]).toEqual(["menubar", "Menus", "no-drag"]);
    expect(items.map(t => [t.getAttribute("data-place"), t.textContent.trim(), t.getAttribute("role")])).toEqual([
      ["shell.file", "File", "menuitem"], ["shell.edit", "Edit", "menuitem"], ["shell.view", "View", "menuitem"]
    ]);
    expect(row.querySelector(".tr-window-row-menu")).toBeNull();
    expect(runs).toEqual([{ template: "plan" }]);
  });

  it("moves between the menu bar's items with the arrow keys and opens a menu with the down arrow", async () => {
    DesktopBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const items = [...fixture.nativeElement.querySelectorAll("button.tr-window-row-menu-bar-item")] as HTMLButtonElement[];
    items[0]?.focus();
    press(items[0] as HTMLElement, "ArrowRight");
    const second = document.activeElement;
    press(items[1] as HTMLElement, "ArrowDown");
    await settle(fixture);

    expect(second).toBe(items[1]);
    expect(items[1]?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("tr-menu[data-place='shell.edit']")).not.toBeNull();
  });

  it("folds the menu bar into the menu button while the row cannot fit it and unfolds it when it can", async () => {
    DesktopBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    const row: HTMLElement = fixture.nativeElement;
    row.style.width = "1000px";
    fixture.detectChanges();
    await settle(fixture);
    const wide = [row.querySelector(".tr-window-row-menu"), row.querySelector("tr-menu-bar")?.classList.contains("tr-window-row-menu-bar-folded")];

    row.style.width = "150px";
    await settle(fixture);
    fixture.detectChanges();
    const bar = row.querySelector("tr-menu-bar") as HTMLElement;
    const narrow = [row.querySelector(".tr-window-row-menu") === null, bar.classList.contains("tr-window-row-menu-bar-folded"), bar.getAttribute("aria-hidden"), bar.hasAttribute("inert"), getComputedStyle(bar).visibility];

    row.style.width = "1000px";
    await settle(fixture);
    fixture.detectChanges();

    expect(wide).toEqual([null, false]);
    expect(narrow).toEqual([false, true, "true", true, "hidden"]);
    expect(row.querySelector(".tr-window-row-menu")).toBeNull();
    expect(bar.classList.contains("tr-window-row-menu-bar-folded")).toBe(false);
  });

  it("shows neither the bar nor the button when the menus are hidden, and ignores Alt and F10", async () => {
    DesktopBridgeFixture.install("win32");
    useMenuBarStyle("Hidden");
    useNotesMenus([]);
    apply();
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    press(field, "F10");
    press(field, "Alt");
    press(field, "Alt", "keyup");

    expect(fixture.nativeElement.querySelector("tr-menu-bar, .tr-window-row-menu")).toBeNull();
    expect(document.activeElement).toBe(field);
    field.remove();
  });

  it("focuses the first menu with F10 or a lone Alt, not with Alt used in a chord or after a click, and Escape gives the focus back", async () => {
    DesktopBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const field = document.createElement("input");
    document.body.append(field);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const first = fixture.nativeElement.querySelector("button.tr-window-row-menu-bar-item") as HTMLElement;
    const focused: (Element | null)[] = [];

    field.focus();
    press(field, "F10", "keydown", { shiftKey: true });
    press(field, "Alt");
    press(field, "x", "keydown", { altKey: true });
    press(field, "Alt", "keyup");
    press(field, "Alt");
    const pointerdown = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    document.dispatchEvent(pointerdown);
    press(field, "Alt", "keyup");
    focused.push(document.activeElement);
    expect(pointerdown.defaultPrevented).toBe(false);
    press(field, "F10");
    focused.push(document.activeElement);
    press(first, "F10");
    press(first, "Escape");
    focused.push(document.activeElement);
    press(field, "Alt");
    press(field, "Alt", "keyup");
    focused.push(document.activeElement);
    field.remove();
    press(first, "Escape");
    press(first, "Escape");
    focused.push(document.activeElement);

    expect(focused).toEqual([field, first, field, first, first]);
    field.remove();
  });

  it("focuses the menu button instead when the menus are a button, and keeps Escape for an open menu", async () => {
    DesktopBridgeFixture.install("win32");
    useMenuBarStyle("Button");
    useNotesMenus([]);
    apply();
    const field = document.createElement("input");
    document.body.append(field);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const button = fixture.nativeElement.querySelector(".tr-window-row-menu") as HTMLButtonElement;

    field.focus();
    press(field, "F10");
    const focused = document.activeElement;
    button.setAttribute("aria-expanded", "true");
    press(button, "Escape");
    const stayed = document.activeElement;

    expect([focused, stayed]).toEqual([button, button]);
    field.remove();
  });

  it("does not move focus to a menu on macOS", async () => {
    DesktopBridgeFixture.install("darwin");
    useNotesMenus([]);
    apply();
    const field = document.createElement("input");
    document.body.append(field);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);

    field.focus();
    press(field, "F10");

    expect(document.activeElement).toBe(field);
    expect(fixture.nativeElement.querySelector("tr-menu-bar")).toBeNull();
    field.remove();
  });

  it("puts the actions placed at the start right after the menu and the others before command search", async () => {
    DesktopBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const action = (name: string, side: TopBarSide): TopBarAction =>
      new TopBarAction(new TopBarActionContribution(name, new TopBarActionState("note_add", name, "notes.newNote"), side), () => undefined);
    TestBed.inject(BarItemsService).set([], [action("notes.print", TopBarSide.End), action("notes.back", TopBarSide.Start), action("notes.forward", TopBarSide.Start)]);

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const row: HTMLElement = fixture.nativeElement;

    expect([...row.children].map(t => `${t.tagName.toLowerCase()}.${[...t.classList].find(u => u.startsWith("tr-window-row-"))}`)).toEqual([
      "tr-menu-bar.tr-window-row-menu-bar", "div.tr-window-row-start", "div.tr-window-row-breadcrumb", "div.tr-window-row-actions"
    ]);
    expect([...row.querySelectorAll(".tr-window-row-start button")].map(t => t.getAttribute("data-tr-item"))).toEqual(["notes.back", "notes.forward"]);
    expect([...row.querySelectorAll(".tr-window-row-actions button")].map(t => t.getAttribute("data-tr-item") ?? "search")).toEqual(["notes.print", "search"]);
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
