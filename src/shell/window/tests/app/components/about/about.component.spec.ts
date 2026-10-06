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
    const away = [text(fixture, ".tr-about-status"), buttons(fixture).length];
    state.set(of(UpdateStateKind.Available, { version: "1.3.0" }));
    await fixture.whenStable();

    expect(off).toEqual(["Updates are turned off in this build.", 0]);
    expect(away).toEqual(["Move TeamRun to Applications to get updates.", 0]);
    expect([text(fixture, ".tr-about-status"), buttons(fixture).length]).toEqual(["Move TeamRun to Applications to get updates.", 0]);
  });

  it("shows each state's line with its action, and the reason when there is one", async () => {
    const checkedAt = new Date(2026, 9, 6, 10, 42).getTime();
    const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(checkedAt);
    const fixture = await renderAsync();
    const shown: string[] = [];
    for (const next of [
      of(UpdateStateKind.UpToDate),
      of(UpdateStateKind.UpToDate, { checkedAt }),
      of(UpdateStateKind.Checking),
      of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 }),
      of(UpdateStateKind.Ready, { version: "1.3.0", reason: "Notes couldn't save." }),
      of(UpdateStateKind.Failed, { reason: "The download doesn't match the release." })
    ]) {
      state.set(next);
      await fixture.whenStable();
      shown.push(`${[...(fixture.nativeElement as HTMLElement).querySelectorAll(".tr-about-status span")].map(t => t.textContent?.trim()).join(" ")} | ${buttons(fixture).map(t => t.textContent?.trim()).join(",")}`);
      for (const button of buttons(fixture))
        button.click();
    }

    expect(shown).toEqual([
      "TeamRun is up to date | Check for updates",
      `TeamRun is up to date, checked ${time} | Check for updates`,
      "Checking for updates… | ",
      "Downloading TeamRun 1.3.0, 42% | ",
      "TeamRun 1.3.0 is ready to install Notes couldn't save. | Restart to update",
      "The update failed The download doesn't match the release. | Try again"
    ]);
    expect(calls).toEqual(["Check", "Check", "Restart", "Check"]);
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
