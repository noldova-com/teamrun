/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ModuleState } from "@noldova/teamrun-shell-protocol";

import { ModuleFailuresComponent } from "../../../../src/app/components/module-failures/module-failures.component";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("ModuleFailuresComponent", () => {
  const clock = new ModuleFailure("clock", "Clock", ModuleState.Failed, "Its runtime part failed to activate.", ["clock.face"]);
  const notes = new ModuleFailure("notes", "Notes", ModuleState.Blocked, "It depends on clock, which is not active.", []);
  let failures: WritableSignal<readonly ModuleFailure[]>;
  let bridge: DesktopBridgeFixture;
  let errors: unknown[];

  beforeEach(() => {
    failures = signal([clock]);
    bridge = DesktopBridgeFixture.install();
    errors = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: { failures } },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  async function renderAsync(): Promise<ComponentFixture<ModuleFailuresComponent>> {
    const fixture = TestBed.createComponent(ModuleFailuresComponent);
    await fixture.whenStable();
    return fixture;
  }

  function item(fixture: ComponentFixture<ModuleFailuresComponent>): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector("button.tr-module-failures-item") as HTMLButtonElement;
  }

  function popover(): HTMLElement | null {
    return document.querySelector(".tr-module-failures-popover");
  }

  function button(name: string): HTMLButtonElement {
    return document.querySelector(`.tr-module-failures-${name}`) as HTMLButtonElement;
  }

  async function settleAsync(): Promise<void> {
    for (let turn = 0; turn < 10; turn++)
      await Promise.resolve();
  }

  async function openAsync(fixture: ComponentFixture<ModuleFailuresComponent>): Promise<HTMLElement> {
    item(fixture).click();
    await fixture.whenStable();
    return popover() as HTMLElement;
  }

  it("shows nothing while every module started", async () => {
    failures.set([]);

    const fixture = await renderAsync();

    expect((fixture.nativeElement as HTMLElement).textContent).toBe("");
  });

  it("counts the modules that didn't start, with an error icon and text", async () => {
    const fixture = await renderAsync();
    const one = item(fixture).textContent;
    failures.set([clock, notes]);
    await fixture.whenStable();

    expect(one).toMatch(/^\s*error\s*1 module didn't start\s*$/);
    expect(item(fixture).textContent).toMatch(/^\s*error\s*2 modules didn't start\s*$/);
    expect(item(fixture).getAttribute("aria-haspopup")).toBe("dialog");
    expect(item(fixture).getAttribute("aria-expanded")).toBe("false");
  });

  it("opens a popover listing each module with its state and cause, and moves focus into it", async () => {
    failures.set([clock, notes]);
    const fixture = await renderAsync();

    const surface = await openAsync(fixture);
    await vi.waitFor(() => expect(document.activeElement).toBe(surface));

    expect(surface.getAttribute("role")).toBe("dialog");
    expect(surface.getAttribute("aria-label")).toBe("Modules that didn't start");
    expect([...surface.querySelectorAll(".tr-module-failures-row")].map(t => [t.getAttribute("data-module"), ...[...t.children].map(u => u.textContent)])).toEqual([
      ["clock", "Clock", "Failed", "Its runtime part failed to activate."],
      ["notes", "Notes", "Blocked", "It depends on clock, which is not active."]
    ]);
    expect(item(fixture).getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape and returns focus to the item, but not on other keys", async () => {
    const fixture = await renderAsync();
    const surface = await openAsync(fixture);

    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    await fixture.whenStable();
    const isOpenAfterTab = popover() !== null;
    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await fixture.whenStable();

    expect(isOpenAfterTab).toBe(true);
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(item(fixture));
  });

  it("closes on a click outside it and when the item is clicked again", async () => {
    const fixture = await renderAsync();
    const outside = document.body.appendChild(document.createElement("div"));
    const click = async (target: Element): Promise<void> => {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await fixture.whenStable();
    };
    await openAsync(fixture);
    const isOpen = popover() !== null;

    await click(outside);
    const isClosedByOutside = popover() === null;
    await click(item(fixture));
    const isOpenedAgain = popover() !== null;
    await click(item(fixture));
    outside.remove();

    expect([isOpen, isClosedByOutside, isOpenedAgain]).toEqual([true, true, true]);
    expect(popover()).toBeNull();
  });

  it("closes once every module has started", async () => {
    const fixture = await renderAsync();
    await openAsync(fixture);

    failures.set([]);
    await fixture.whenStable();

    expect(popover()).toBeNull();
  });

  it("copies the build and each module's id, state and cause, and says Copied for a while", async () => {
    failures.set([clock, notes]);
    const fixture = await renderAsync();
    await openAsync(fixture);
    vi.useFakeTimers();

    button("copy").click();
    await settleAsync();
    fixture.detectChanges();
    const copied = button("copy").textContent;
    vi.advanceTimersByTime(1000);
    button("copy").click();
    await settleAsync();
    vi.advanceTimersByTime(1999);
    fixture.detectChanges();
    const stillCopied = button("copy").textContent;
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    expect(bridge.copied).toEqual([
      "TeamRun 1.2.3, build abc123\nclock: Failed: Its runtime part failed to activate.\nnotes: Blocked: It depends on clock, which is not active.",
      "TeamRun 1.2.3, build abc123\nclock: Failed: Its runtime part failed to activate.\nnotes: Blocked: It depends on clock, which is not active."
    ]);
    expect(copied).toMatch(/^\s*check\s*Copied\s*$/);
    expect(stillCopied).toMatch(/^\s*check\s*Copied\s*$/);
    expect(button("copy").textContent).toMatch(/^\s*content_copy\s*Copy details\s*$/);
  });

  it("says nothing was copied when the desktop refuses and reports a build it cannot read", async () => {
    const fixture = await renderAsync();
    await openAsync(fixture);
    bridge.isCopyAccepted = false;

    button("copy").click();
    await vi.waitFor(() => expect(bridge.copied).toEqual([]));
    bridge.build = null;
    button("copy").click();
    await vi.waitFor(() => expect(errors.length).toBe(1));
    fixture.detectChanges();

    expect(button("copy").textContent).toContain("Copy details");
  });

  it("opens the log folder and says when it could not", async () => {
    const fixture = await renderAsync();
    await openAsync(fixture);

    button("logs").click();
    await vi.waitFor(() => expect(bridge.logFolderOpens).toBe(1));
    await fixture.whenStable();
    const noticeAfterOpening = document.querySelector(".tr-module-failures-notice");
    bridge.logFolderOpened = Promise.resolve(false);
    button("logs").click();
    await vi.waitFor(() => expect(document.querySelector(".tr-module-failures-notice")?.textContent).toBe("The log folder could not be opened."));
    item(fixture).click();
    await fixture.whenStable();
    await openAsync(fixture);
    const noticeAfterReopening = document.querySelector(".tr-module-failures-notice");
    bridge.logFolderOpened = Promise.reject(new Error("The bridge closed."));
    button("logs").click();
    await vi.waitFor(() => expect(errors.length).toBe(1));
    await fixture.whenStable();

    expect(noticeAfterOpening).toBeNull();
    expect(noticeAfterReopening).toBeNull();
    expect(document.querySelector(".tr-module-failures-notice")?.getAttribute("role")).toBe("status");
  });

  it("stops its Copied timer when destroyed", async () => {
    const fixture = await renderAsync();
    await openAsync(fixture);
    const clearing = vi.spyOn(globalThis, "clearTimeout");

    button("copy").click();
    await vi.waitFor(() => expect(bridge.copied.length).toBe(1));
    fixture.destroy();

    expect(clearing).toHaveBeenCalled();
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await renderAsync();

        const itemStyle = getComputedStyle(item(fixture));
        const icon = getComputedStyle(item(fixture).querySelector(".tr-module-failures-icon") as Element);
        const surface = getComputedStyle(await openAsync(fixture));

        expect(itemStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(icon.color).toBe(AppearanceFixture.readColor(theme, mode, "errorForeground"));
        AppearanceFixture.expectLook(itemStyle.paddingLeft, theme, "status-bar-item-padding", "padding-left");
        AppearanceFixture.expectLook(itemStyle.height, theme, "status-bar-item-height", "height");
        AppearanceFixture.expectLook(itemStyle.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
        AppearanceFixture.expectLook(icon.fontSize, theme, "icon", "font-size");
        expect(surface.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "menu.background"));
        expect(surface.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "menu.border"));
        expect(surface.boxShadow).not.toBe("none");
        AppearanceFixture.expectLook(surface.width, theme, "popover-width", "width");
        AppearanceFixture.expectLook(surface.borderTopLeftRadius, theme, "radius-large", "border-top-left-radius");
        AppearanceFixture.expectLook(surface.paddingTop, theme, "space-3", "padding-top");
      });
});
