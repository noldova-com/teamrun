/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { TooltipDirective } from "@noldova/teamrun-shell-ui";

import { StatusBarItemComponent } from "../../../../src/app/components/status-bar-item/status-bar-item.component";
import { StatusBarSide } from "../../../../src/app/enums/status-bar-side";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { StatusBarItem } from "../../../../src/app/models/status-bar-item";
import { StatusBarItemContribution } from "../../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../../src/app/models/status-bar-item-state";
import { CommandService } from "../../../../src/app/services/command.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("StatusBarItemComponent", () => {
  const LONG = "2 notes, neither pinned nor archived, both last changed today and both waiting for review";

  let errors: unknown[];
  let runs: JsonValue[];

  beforeEach(() => {
    errors = [];
    runs = [];
    DesktopBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
  });

  afterEach(() => {
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  function register(...names: readonly string[]): void {
    TestBed.inject(CommandService).setCommands(names.map(t => new CommandContribution(t, "Tick", null, null, async u => {
      runs.push(u);
      if (t === "clock.fail")
        throw new Error("The clock stopped.");
      return null;
    })));
  }

  function render(state: StatusBarItemState): [ComponentFixture<StatusBarItemComponent>, StatusBarItem] {
    const item = new StatusBarItem(new StatusBarItemContribution("clock.ticks", StatusBarSide.Right, state), () => undefined);
    const fixture = TestBed.createComponent(StatusBarItemComponent);
    fixture.componentRef.setInput("item", item);
    fixture.detectChanges();
    return [fixture, item];
  }

  it("shows an item without a command as a pill that is not a button, named by its text", () => {
    const [fixture] = render(new StatusBarItemState("2 notes"));
    const host: HTMLElement = fixture.nativeElement;
    const pill = host.querySelector(".tr-status-bar-item");

    expect(host.querySelector("button")).toBeNull();
    expect([pill?.getAttribute("role"), pill?.getAttribute("aria-label"), pill?.textContent?.trim()]).toEqual(["status", "2 notes", "2 notes"]);
    expect(host.getAttribute("data-tr-item")).toBe("clock.ticks");
  });

  it("runs its command with its arguments when clicked, while the command is registered", () => {
    register("clock.tick");
    const [fixture] = render(new StatusBarItemState("No ticks", { icon: "timer", tooltip: "Tick the clock", command: "clock.tick", commandArguments: { by: 2 } }));
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector("button.tr-status-bar-item");

    button?.click();

    expect(button?.disabled).toBe(false);
    expect(button?.querySelector(".tr-status-bar-item-icon")?.textContent).toBe("timer");
    expect(button?.getAttribute("aria-label")).toBeNull();
    expect(runs).toEqual([{ by: 2 }]);
  });

  it("is disabled while its command is not registered", () => {
    const [fixture] = render(new StatusBarItemState("No ticks", { command: "clock.tick" }));
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector("button");

    expect(button?.disabled).toBe(true);

    register("clock.tick");
    fixture.detectChanges();

    expect(button?.disabled).toBe(false);
  });

  it("reports a command that fails", async () => {
    register("clock.fail");
    const [fixture] = render(new StatusBarItemState("No ticks", { command: "clock.fail" }));

    fixture.nativeElement.querySelector("button")?.click();
    await fixture.whenStable();

    expect(errors.map(t => String(t))).toEqual(["Error: The clock stopped."]);
  });

  it("names an icon-only item by its tooltip", () => {
    const [fixture] = render(new StatusBarItemState("", { icon: "notifications", tooltip: "Notifications" }));
    const pill = fixture.nativeElement.querySelector(".tr-status-bar-item");

    expect(pill?.getAttribute("aria-label")).toBe("Notifications");
    expect(pill?.querySelector(".tr-status-bar-item-text")).toBeNull();
  });

  it("follows its updates and hides while it is hidden", () => {
    AppearanceFixture.apply();
    const [fixture, item] = render(new StatusBarItemState("2 notes"));
    const host: HTMLElement = fixture.nativeElement;

    item.update(new StatusBarItemState("3 notes"));
    fixture.detectChanges();
    const shown = host.textContent?.trim();
    item.update(new StatusBarItemState("3 notes", { isHidden: true }));
    fixture.detectChanges();

    expect(shown).toBe("3 notes");
    expect(getComputedStyle(host).display).toBe("none");
  });

  for (const [kind, command] of [["a plain", {}], ["a button", { command: "clock.tick" }]] as const)
    for (const [owning, tooltip] of [["without", {}], ["with", { tooltip: "Tick the clock" }]] as const)
      it(`shows the full text of ${kind} item ${owning} its own tooltip only when cut short, and is named by it`, async () => {
        AppearanceFixture.apply();
        register("clock.tick");
        const shownFor = async (text: string): Promise<string | null> => {
          const [fixture] = render(new StatusBarItemState(text, { ...command, ...tooltip }));
          const host: HTMLElement = fixture.nativeElement;
          host.style.width = "6rem";
          const directive = fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);
          directive.show();
          await fixture.whenStable();
          const shown = document.querySelector(".cdk-overlay-container tr-tooltip")?.textContent?.trim() ?? null;
          directive.hide();
          const pill = host.querySelector(".tr-status-bar-item");
          expect(pill?.getAttribute("aria-label")).toBe("command" in command ? null : text);
          expect(pill?.textContent?.trim()).toBe(text);
          fixture.destroy();
          return shown;
        };

        const long = await shownFor(LONG);
        const short = await shownFor("2 notes");

        expect([long, short]).toEqual("tooltip" in tooltip ? [tooltip.tooltip, tooltip.tooltip] : [LONG, null]);
      });

  for (const theme of AppearanceFixture.themes)
    it(`is a pill with the ${theme.id} theme's status bar item geometry`, () => {
      AppearanceFixture.apply(theme);
      register("clock.tick");

      const [fixture] = render(new StatusBarItemState("No ticks", { command: "clock.tick" }));
      const host = getComputedStyle(fixture.nativeElement);
      const pill = getComputedStyle(fixture.nativeElement.querySelector(".tr-status-bar-item"));

      AppearanceFixture.expectLook(host.height, theme, "status-bar-item-height", "height");
      AppearanceFixture.expectLook(pill.paddingLeft, theme, "status-bar-item-padding", "padding-left");
      AppearanceFixture.expectLook(pill.paddingRight, theme, "status-bar-item-padding", "padding-right");
      AppearanceFixture.expectLook(pill.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
    });
});
