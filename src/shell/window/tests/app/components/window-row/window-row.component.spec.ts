/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { AppearanceService, DefaultTheme, DialogService, ModePreference, type Theme, ThemeMode, TooltipDirective, Typography } from "@noldova/teamrun-shell-ui";

import { WindowRowComponent } from "../../../../src/app/components/window-row/window-row.component";
import { TopBarSide } from "../../../../src/app/enums/top-bar-side";
import { BuildTokens } from "../../../../src/app/models/build-tokens";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { DocumentHeading } from "../../../../src/app/models/document-heading";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import { ShellDocuments } from "../../../../src/app/models/shell-documents";
import { TopBarAction } from "../../../../src/app/models/top-bar-action";
import { TopBarActionContribution } from "../../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../../src/app/models/top-bar-action-state";
import { BarItemsService } from "../../../../src/app/services/bar-items.service";
import { CommandSearchService } from "../../../../src/app/services/command-search.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { MenuService } from "../../../../src/app/services/menu.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { TabLabelService } from "../../../../src/app/services/tab-label.service";
import { Resources } from "../../../../src/resources";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { FixtureTheme } from "../../../../../ui/tests/fixtures/fixture-theme";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

@Component({
  template: `<button type="button" class="inside">Keep working</button>`
})
class OpenDialogComponent {
}

describe("WindowRowComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  function apply(theme: Theme = DefaultTheme.theme, mode: ThemeMode = ThemeMode.Light, panelSize?: number): void {
    AppearanceFixture.apply(theme, mode, panelSize);
    const appearance = TestBed.inject(AppearanceService);
    appearance.setTheme(theme);
    appearance.setModePreference(mode === ThemeMode.Dark ? ModePreference.Dark : ModePreference.Light);
    appearance.setTypography(new Typography(panelSize));
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

  for (const mode of AppearanceFixture.modes)
    it(`mutes the breadcrumb on the title bar and keeps it readable in ${mode} mode`, () => {
      DesktopBridgeFixture.install();
      apply(DefaultTheme.theme, mode);
      useHeadings().openDocument(LayoutFixture.plan);

      const row = render();
      const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
      const paint = (color: string): string => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        return `rgb(${red}, ${green}, ${blue})`;
      };
      const [segment, title] = [".tr-window-row-segment", ".tr-window-row-title"].map(t => paint(getComputedStyle(row.querySelector(t) as HTMLElement).color));

      expect(segment).not.toBe(title);
      expect(AppearanceFixture.contrast(segment ?? "", getComputedStyle(row).backgroundColor)).toBeGreaterThanOrEqual(4.5);
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
    expect(style.paddingLeft).toBe(`${AppearanceFixture.toPixels(0.25)}px`);
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
      titleBarHeight: AppearanceFixture.toPixels(2)
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

  it("leaves the traffic lights' space free on macOS and ends at the panels' edge on the right", () => {
    DesktopBridgeFixture.install("darwin");
    apply();

    const row = render();
    const style = getComputedStyle(row);

    expect(row.classList.contains("tr-window-row-mac")).toBe(true);
    expect([style.paddingLeft, style.paddingRight]).toEqual(["78px", `${AppearanceFixture.toPixels(0.25)}px`]);
  });

  it("starts at the panels' edge in full screen on macOS, where the traffic lights hide, and leaves their space free again after", async () => {
    const bridge = DesktopBridgeFixture.install("darwin");
    bridge.fullScreen = Promise.resolve(true);
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();
    const row = fixture.nativeElement as HTMLElement;
    const opened = getComputedStyle(row).paddingLeft;

    bridge.changeFullScreen(false);
    await fixture.whenStable();
    const left = getComputedStyle(row).paddingLeft;
    bridge.changeFullScreen(true);
    await fixture.whenStable();

    expect([opened, left, getComputedStyle(row).paddingLeft]).toEqual([`${AppearanceFixture.toPixels(0.25)}px`, "78px", `${AppearanceFixture.toPixels(0.25)}px`]);
  });

  it("reports a failed read of the full-screen state and keeps the traffic lights' space", async () => {
    const bridge = DesktopBridgeFixture.install("darwin");
    bridge.fullScreen = Promise.reject(new Error("The desktop went away."));
    const handled: unknown[] = [];
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => handled.push(error) } }] });
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();

    expect([getComputedStyle(fixture.nativeElement as HTMLElement).paddingLeft, handled.map(t => String(t))]).toEqual(["78px", ["Error: The desktop went away."]]);
  });

  function useNotesMenus(runs: JsonValue[]): void {
    TestBed.configureTestingModule({
      providers: [{
        provide: BuildTokens.menus, useValue: [MenuDeclarations.fromJson("notes", {
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

  for (const panelSize of [12, 13, 18])
    for (const platform of ["win32", "linux", "darwin"])
      it(`stands as high as its tallest control and 0.25rem above and below it at panel size ${panelSize} on ${platform}`, async () => {
        DesktopBridgeFixture.install(platform);
        useNotesMenus([]);
        apply(DefaultTheme.theme, ThemeMode.Light, panelSize);

        const fixture = TestBed.createComponent(WindowRowComponent);
        fixture.detectChanges();
        await settle(fixture);
        const row: HTMLElement = fixture.nativeElement;
        const bounds = row.getBoundingClientRect();
        const controls = [...row.querySelectorAll<HTMLElement>("button")].filter(t => t.checkVisibility({ visibilityProperty: true })).map(t => t.getBoundingClientRect());
        const gap = AppearanceFixture.toPixels(0.25, panelSize);

        expect(controls.length).toBeGreaterThan(platform === "darwin" ? 0 : 3);
        AppearanceFixture.expectPixels(bounds.height, Math.max(24, AppearanceFixture.toPixels(1.375, panelSize)) + 2 * gap);
        AppearanceFixture.expectPixels(bounds.bottom - Math.max(...controls.map(t => t.bottom)), gap);
        AppearanceFixture.expectPixels(Math.min(...controls.map(t => t.top)) - bounds.top, gap);
      });

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

  for (const panelSize of [12, 18])
    it(`folds the menu bar once the row cannot leave 6rem for dragging, at panel size ${panelSize}`, async () => {
      DesktopBridgeFixture.install("win32");
      useNotesMenus([]);
      apply();
      TestBed.inject(AppearanceService).setTypography(new Typography(panelSize));
      const fixture = TestBed.createComponent(WindowRowComponent);
      const row: HTMLElement = fixture.nativeElement;
      row.style.width = "1000px";
      fixture.detectChanges();
      await settle(fixture);
      const style = getComputedStyle(row);
      const parts = [".tr-window-row-start", ".tr-window-row-actions", "tr-menu-bar"].map(t => (row.querySelector(t) as HTMLElement).offsetWidth);
      const fits = Math.ceil(parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parts.reduce((a, b) => a + b, 0) + AppearanceFixture.toPixels(6, panelSize));
      const folded = (): boolean | undefined => row.querySelector("tr-menu-bar")?.classList.contains("tr-window-row-menu-bar-folded");

      row.style.width = `${fits}px`;
      await settle(fixture);
      fixture.detectChanges();
      const atFit = folded();
      row.style.width = `${fits - 1}px`;
      await settle(fixture);
      fixture.detectChanges();

      expect([atFit, folded()]).toEqual([false, true]);
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

  it("leaves the focus in an open dialog on F10 or a lone Alt, and focuses the first menu again once the dialog closes", async () => {
    DesktopBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const first = fixture.nativeElement.querySelector("button.tr-window-row-menu-bar-item") as HTMLElement;
    const dialog = TestBed.inject(DialogService).open(OpenDialogComponent, ".inside");
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("inside")).toBe(true));
    const inside = document.activeElement as HTMLElement;

    press(inside, "F10");
    press(inside, "Alt");
    press(inside, "Alt", "keyup");
    const whileOpen = document.activeElement;
    dialog.close();
    await settle(fixture);
    press(document.body, "F10");

    expect(whileOpen).toBe(inside);
    expect(document.activeElement).toBe(first);
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

  function useHeadings(): LayoutService {
    const layout = TestBed.inject(LayoutService);
    const labels = TestBed.inject(TabLabelService);
    layout.setRegistry(LayoutFixture.createRegistry());
    labels.register(ShellDocuments.settings.name, ShellDocuments.settingsLabel);
    labels.setHeading(LayoutFixture.plan, new DocumentHeading("Plan", ["Notes", "Drafts"]));
    labels.setHeading(LayoutFixture.todo, new DocumentHeading("A todo list for the release that goes on and on", ["The notes of the whole team", "Everything that is not done yet"]));
    return layout;
  }

  it("shows the active document's breadcrumb and title, follows the active document, and names the window after it", async () => {
    DesktopBridgeFixture.install("win32");
    apply();
    const layout = useHeadings();
    const fixture = TestBed.createComponent(WindowRowComponent);
    const row: HTMLElement = fixture.nativeElement;
    const read = (): (string | null)[] => {
      const heading = row.querySelector(".tr-window-row-breadcrumb .tr-window-row-heading");
      return [heading?.getAttribute("aria-label") ?? null, [...heading?.querySelectorAll(".tr-window-row-segment, .tr-window-row-title") ?? []].map(t => t.textContent).join("|"), document.title];
    };
    fixture.detectChanges();
    const empty = read();

    layout.openDocument(LayoutFixture.plan);
    fixture.detectChanges();
    const plan = read();
    const heading = row.querySelector(".tr-window-row-heading") as HTMLElement;
    const styles = [heading, row.querySelector(".tr-window-row-title")].map(t => getComputedStyle(t as HTMLElement)).map(t => [t.getPropertyValue("app-region"), t.fontWeight]);
    const hidden = heading.querySelectorAll("[aria-hidden='true']").length;
    TestBed.inject(TabLabelService).setHeading(LayoutFixture.plan, new DocumentHeading("Launch plan"));
    fixture.detectChanges();
    const renamed = read();
    layout.openDocument(ShellDocuments.settingsTab);
    fixture.detectChanges();
    const settings = read();
    layout.activate(LayoutFixture.files);
    fixture.detectChanges();

    expect(empty).toEqual([null, "", Resources.productName]);
    expect(plan).toEqual(["Notes › Drafts › Plan", "Notes|Drafts|Plan", Resources.formatWindowTitle("Plan")]);
    expect([styles[0]?.[0], styles[1]?.[1]]).toEqual(["drag", "600"]);
    expect(hidden).toBe(5);
    expect(renamed).toEqual(["Launch plan", "Launch plan", Resources.formatWindowTitle("Launch plan")]);
    expect(settings).toEqual(["Settings", "Settings", Resources.formatWindowTitle("Settings")]);
    expect(read()).toEqual(["Settings", "Settings", Resources.formatWindowTitle("Settings")]);
  });

  it("cuts the breadcrumb before the title and leaves 6rem before the actions, without a tooltip that a drag region could not show", async () => {
    DesktopBridgeFixture.install("win32");
    apply();
    const layout = useHeadings();
    const fixture = TestBed.createComponent(WindowRowComponent);
    const row: HTMLElement = fixture.nativeElement;
    row.style.width = "1600px";
    layout.openDocument(LayoutFixture.todo);
    fixture.detectChanges();
    await settle(fixture);
    const isCut = (selector: string): boolean[] => [...row.querySelectorAll<HTMLElement>(selector)].map(t => t.scrollWidth > t.clientWidth);
    const wide = [isCut(".tr-window-row-segment"), isCut(".tr-window-row-title")];

    row.style.width = "640px";
    await settle(fixture);
    const middle = [isCut(".tr-window-row-segment"), isCut(".tr-window-row-title")];
    row.style.width = "300px";
    await settle(fixture);
    const heading = row.querySelector(".tr-window-row-heading") as HTMLElement;
    const actions = row.querySelector(".tr-window-row-actions") as HTMLElement;
    const drag = actions.getBoundingClientRect().left - heading.getBoundingClientRect().right;

    expect(wide).toEqual([[false, false], [false]]);
    expect(middle).toEqual([[true, true], [false]]);
    expect(isCut(".tr-window-row-title")).toEqual([true]);
    expect(getComputedStyle(row.querySelector(".tr-window-row-title") as HTMLElement).textOverflow).toBe("ellipsis");
    expect(drag).toBeGreaterThanOrEqual(AppearanceFixture.toPixels(6) - 0.5);
    expect(fixture.debugElement.query(By.css(".tr-window-row-heading")).injector.get(TooltipDirective, null)).toBeNull();
  });
});
