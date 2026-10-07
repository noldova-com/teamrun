/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { AboutComponent } from "../../../../src/app/components/about/about.component";
import { UpdateStateKind } from "../../../../src/app/enums/update-state-kind";
import { UpdateState } from "../../../../src/app/models/update-state";
import { UpdateService } from "../../../../src/app/services/update.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";

describe("AboutComponent", () => {
  let state: WritableSignal<UpdateState>;
  let calls: string[];
  let errors: unknown[];
  let bridge: DesktopBridgeFixture;

  const of = (kind: UpdateStateKind, fields: Partial<{ version: string; progress: number; checkedAt: number; reason: string; mustMove: boolean }> = {}): UpdateState =>
    new UpdateState(kind, fields.version ?? null, fields.progress ?? null, fields.checkedAt ?? null, fields.reason ?? null, fields.mustMove ?? false);

  beforeEach(() => {
    state = signal(UpdateState.off);
    calls = [];
    errors = [];
    bridge = DesktopBridgeFixture.install("darwin");
    bridge.processor = "arm64";
    TestBed.configureTestingModule({
      providers: [
        { provide: UpdateService, useValue: { state, act: (action: string) => calls.push(action) } },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    DesktopBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  async function renderAsync(): Promise<ComponentFixture<AboutComponent>> {
    const fixture = TestBed.createComponent(AboutComponent);
    await fixture.whenStable();
    return fixture;
  }

  function text(fixture: ComponentFixture<AboutComponent>, selector: string): string {
    return String((fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim());
  }

  function buttons(fixture: ComponentFixture<AboutComponent>): readonly HTMLButtonElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>("button")];
  }

  it("names TeamRun's version, platform and processor as a region of the page", async () => {
    const fixture = await renderAsync();
    const host = fixture.nativeElement as HTMLElement;

    expect([text(fixture, ".tr-about-title"), text(fixture, ".tr-about-platform")]).toEqual(["TeamRun 1.2.3", "macOS ARM64"]);
    expect([host.getAttribute("role"), host.getAttribute("aria-label"), host.classList.contains("tr-settings-group")]).toEqual(["region", "About TeamRun", true]);
  });

  it("names an unknown platform and processor as the desktop gives them, and reports a version it cannot read", async () => {
    bridge.platform = "freebsd";
    bridge.processor = "riscv64";
    bridge.build = { productVersion: 3 };

    const fixture = await renderAsync();
    await fixture.whenStable();

    expect([text(fixture, ".tr-about-title"), text(fixture, ".tr-about-platform")]).toEqual(["TeamRun", "freebsd riscv64"]);
    expect(errors.length).toBe(1);
  });

  it("says why a build that cannot update doesn't, with no button", async () => {
    const fixture = await renderAsync();
    const off = [text(fixture, ".tr-about-status"), buttons(fixture).length];
    state.set(of(UpdateStateKind.Available, { version: "1.3.0", reason: "Hidden", mustMove: true }));
    await fixture.whenStable();

    expect(off).toEqual(["Updates are turned off in this build.", 0]);
    expect([text(fixture, ".tr-about-status"), buttons(fixture).length]).toEqual(["Move TeamRun to Applications to get updates.", 0]);
  });

  it("shows each state's line with its action, then the last check, the reason or the move to Applications, the details muted", async () => {
    AppearanceFixture.apply();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 23, 59));
    const today = new Date(2026, 9, 6, 10, 42);
    const earlier = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3, 10, 42).getTime();
    const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(today);
    const dayAndTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(earlier);
    const fixture = await renderAsync();
    const probe = (fixture.nativeElement as HTMLElement).appendChild(document.createElement("span"));
    probe.style.color = "var(--tr-text-muted)";
    const mutedColor = getComputedStyle(probe).color;
    probe.remove();
    const shown: string[] = [];
    const muted: (readonly boolean[])[] = [];
    for (const next of [
      of(UpdateStateKind.UpToDate),
      of(UpdateStateKind.UpToDate, { checkedAt: today.getTime() }),
      of(UpdateStateKind.UpToDate, { checkedAt: earlier }),
      of(UpdateStateKind.Checking),
      of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 }),
      of(UpdateStateKind.Ready, { version: "1.3.0", reason: "Notes couldn't save." }),
      of(UpdateStateKind.Ready),
      of(UpdateStateKind.Failed, { reason: "The download doesn't match the release." }),
      of(UpdateStateKind.Failed, { reason: "The release's information is invalid.", mustMove: true })
    ]) {
      state.set(next);
      await fixture.whenStable();
      const lines = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(".tr-about-status > span")];
      shown.push(`${lines.map(t => t.textContent).join(" / ")} | ${buttons(fixture).map(t => t.textContent?.trim()).join(",")}`);
      muted.push(lines.map(t => getComputedStyle(t).color === mutedColor));
      for (const button of buttons(fixture))
        button.click();
    }

    expect(shown).toEqual([
      "TeamRun is up to date. | Check for updates",
      `TeamRun is up to date. / Last checked ${time}. | Check for updates`,
      `TeamRun is up to date. / Last checked ${dayAndTime}. | Check for updates`,
      "Checking for updates… | ",
      "Downloading TeamRun 1.3.0… 42% | ",
      "TeamRun 1.3.0 is ready to install. / Notes couldn't save. | Restart to update",
      "TeamRun is ready to install. | Restart to update",
      "The update failed. / The download doesn't match the release. | Try again",
      "The update failed. / The release's information is invalid. / Move TeamRun to Applications to get updates. | Try again"
    ]);
    expect(muted).toEqual([[false], [false, true], [false, true], [false], [false], [false, true], [false], [false, true], [false, true, false]]);
    expect(calls).toEqual(["Check", "Check", "Check", "Restart", "Restart", "Check", "Check"]);
  });

  it("keeps the download's percentage out of its polite status, since the progress bar carries it", async () => {
    state.set(of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 }));
    const fixture = await renderAsync();
    const status = (fixture.nativeElement as HTMLElement).querySelector(".tr-about-status") as HTMLElement;
    const hidden = [...status.querySelectorAll("[aria-hidden=true]")].map(t => t.textContent);

    expect([status.getAttribute("role"), hidden]).toEqual(["status", [" 42%"]]);
  });

  for (const [kind, label] of [[UpdateStateKind.UpToDate, "Check for updates"], [UpdateStateKind.Failed, "Try again"]] as const)
    it(`keeps focus on the update's status once ${label} is chosen and its button goes away`, async () => {
      state.set(of(kind));
      const fixture = await renderAsync();
      const button = buttons(fixture)[0] as HTMLButtonElement;
      button.focus();

      button.click();
      state.set(of(UpdateStateKind.Checking));
      await fixture.whenStable();

      expect([button.textContent?.trim(), buttons(fixture).length, document.activeElement?.className, calls]).toEqual([label, 0, "tr-about-status", ["Check"]]);
    });

  it("keeps focus on the update's status when a check it didn't ask for removes the focused button, and never takes focus from anywhere else", async () => {
    state.set(of(UpdateStateKind.UpToDate));
    const fixture = await renderAsync();
    const outside = document.body.appendChild(document.createElement("button"));
    (buttons(fixture)[0] as HTMLButtonElement).focus();

    state.set(of(UpdateStateKind.Checking));
    await fixture.whenStable();
    const onButton = document.activeElement?.className;
    state.set(of(UpdateStateKind.Ready, { version: "1.3.0" }));
    await fixture.whenStable();
    (buttons(fixture)[0] as HTMLButtonElement).focus();
    state.set(of(UpdateStateKind.Ready, { version: "1.3.0", reason: "Notes couldn't save." }));
    await fixture.whenStable();
    const kept = document.activeElement?.textContent?.trim();
    outside.focus();
    state.set(of(UpdateStateKind.Failed));
    await fixture.whenStable();
    const elsewhere = document.activeElement;
    outside.remove();

    expect([onButton, kept, elsewhere === outside]).toEqual(["tr-about-status", "Restart to update", true]);
  });

  it("shows the download's progress below its line and as wide as it, named for the download, and an unknown amount while it has none", async () => {
    AppearanceFixture.apply();
    state.set(of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 }));
    const fixture = await renderAsync();
    const host = fixture.nativeElement as HTMLElement;
    host.style.width = "800px";
    const bar = (): HTMLElement | null => host.querySelector("[role=progressbar]");
    const line = (host.querySelector(".tr-about-update") as HTMLElement).getBoundingClientRect();
    const track = (host.querySelector(".tr-about-progress") as HTMLElement).getBoundingClientRect();
    const known = [bar()?.getAttribute("aria-label"), bar()?.getAttribute("aria-valuenow")];
    state.set(of(UpdateStateKind.Downloading));
    await fixture.whenStable();
    const unknown = [bar()?.getAttribute("aria-label"), bar()?.getAttribute("aria-valuenow")];
    state.set(of(UpdateStateKind.Ready, { version: "1.3.0" }));
    await fixture.whenStable();

    expect([track.left, track.width, track.top - line.bottom]).toEqual([line.left, line.width, AppearanceFixture.toPixels(0.25)]);
    expect(line.width).toBeLessThan(400);
    expect(known).toEqual(["Downloading TeamRun 1.3.0", "0.42"]);
    expect(unknown).toEqual(["Downloading TeamRun", null]);
    expect(bar()).toBeNull();
  });
});
