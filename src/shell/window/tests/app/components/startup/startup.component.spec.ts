/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { StartupComponent } from "../../../../src/app/components/startup/startup.component";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

describe("StartupComponent", () => {
  let bridge: DesktopBridgeFixture;

  beforeEach(() => {
    AppearanceFixture.apply();
    bridge = DesktopBridgeFixture.install();
  });

  afterEach(() => {
    AppearanceFixture.reset();
    DesktopBridgeFixture.remove();
  });

  async function renderAsync(kind: string, details: readonly string[]): Promise<ComponentFixture<StartupComponent>> {
    bridge.startup = { kind, details };
    const fixture = TestBed.createComponent(StartupComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function texts(fixture: ComponentFixture<StartupComponent>, selector: string): string[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  }

  function buttons(fixture: ComponentFixture<StartupComponent>): HTMLButtonElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll("button")];
  }

  it("says TeamRun is starting while it connects, as a polite status", async () => {
    const fixture = await renderAsync("Connecting", []);
    const card = (fixture.nativeElement as HTMLElement).querySelector(".tr-startup-card");

    expect(texts(fixture, "p")).toEqual(["Starting TeamRun…"]);
    expect(card?.getAttribute("role")).toBe("status");
    expect(card?.getAttribute("aria-live")).toBe("polite");
    expect(buttons(fixture)).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).classList.contains("tr-scroll-reveal")).toBe(true);
  });

  it("explains data from before the shell and moves it aside on request", async () => {
    const fixture = await renderAsync("PreShellData", ["/home/person/.noldova/teamrun"]);

    expect(texts(fixture, "h1")).toEqual(["Data from an earlier TeamRun"]);
    expect(texts(fixture, "p")[0]).toBe("/home/person/.noldova/teamrun");
    expect(texts(fixture, "p")[1]).toContain("changes and deletes nothing");
    expect(texts(fixture, "button")).toEqual(["Move aside"]);
    buttons(fixture)[0]?.click();
    fixture.detectChanges();

    expect(buttons(fixture)[0]?.disabled).toBe(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(buttons(fixture)[0]?.disabled).toBe(false);
    expect(bridge.actions).toEqual(["moveAside"]);
  });

  it("lists an older build's work and offers to wait for it or stop it", async () => {
    const fixture = await renderAsync("WorkInProgress", ["A reply", "A command"]);

    expect(texts(fixture, "h1")).toEqual(["An older TeamRun is still working"]);
    expect(texts(fixture, "li")).toEqual(["A reply", "A command"]);
    expect(texts(fixture, "button")).toEqual(["Wait for it", "Stop the work"]);
    expect(buttons(fixture)[1]?.classList.contains("tr-button-secondary")).toBe(true);
    buttons(fixture)[0]?.click();
    await fixture.whenStable();
    buttons(fixture)[1]?.click();
    await fixture.whenStable();

    expect(bridge.actions).toEqual(["wait", "stopWork"]);
  });

  it("shows the work it waits for", async () => {
    const fixture = await renderAsync("WaitingForWork", ["A reply"]);

    expect(texts(fixture, "h1")).toEqual(["Waiting for the older TeamRun"]);
    expect(texts(fixture, "li")).toEqual(["A reply"]);
    expect(buttons(fixture)).toEqual([]);
  });

  it("names the newer build that is running", async () => {
    const fixture = await renderAsync("NewerBuild", ["2.0.0"]);

    expect(texts(fixture, "h1")).toEqual(["A newer TeamRun is running"]);
    expect(texts(fixture, "p")).toEqual(["TeamRun 2.0.0 is using this data folder. Use that TeamRun instead."]);
  });

  it("shows why TeamRun could not start and offers to try again", async () => {
    const fixture = await renderAsync("Failed", ["The runtime did not start in time."]);

    expect(texts(fixture, "h1")).toEqual(["TeamRun could not start"]);
    expect(texts(fixture, "p")).toEqual(["The runtime did not start in time."]);
    buttons(fixture)[0]?.click();
    await fixture.whenStable();

    expect(bridge.actions).toEqual(["retry"]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`draws its card from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await renderAsync("Failed", ["The runtime did not start in time."]);
        const root = fixture.nativeElement as HTMLElement;
        const card = getComputedStyle(root.querySelector(".tr-startup-card") ?? root);
        const title = getComputedStyle(root.querySelector("h1") ?? root);
        const detail = getComputedStyle(root.querySelector(".tr-startup-detail") ?? root);

        expect(card.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "editor.background"));
        expect(card.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "surface.border"));
        expect(card.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        expect(detail.color).toBe(AppearanceFixture.readColor(theme, mode, "teamrun.mutedForeground"));
        expect(title.fontWeight).toBe("600");
        AppearanceFixture.expectLook(card.borderTopLeftRadius, theme, "radius-large", "border-top-left-radius");
        AppearanceFixture.expectLook(card.paddingTop, theme, "space-6", "padding-top");
      });

  it("fits a narrow window and wraps a long path within the card", async () => {
    const fixture = await renderAsync("PreShellData", ["/".repeat(400)]);
    const root = fixture.nativeElement as HTMLElement;
    root.style.width = "200px";
    const card = root.querySelector<HTMLElement>(".tr-startup-card") ?? root;

    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(200);
  });
});
