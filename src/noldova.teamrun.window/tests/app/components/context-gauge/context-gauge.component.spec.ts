/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { ContextUsage } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { ContextGaugeComponent } from "../../../../src/app/components/context-gauge/context-gauge.component";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ContextGaugeComponent", () => {
  const render = (context: ContextUsage, teammate: string = "Ada"): ComponentFixture<ContextGaugeComponent> => {
    TestBed.configureTestingModule({ imports: [ContextGaugeComponent] });
    const fixture = TestBed.createComponent(ContextGaugeComponent);
    fixture.componentRef.setInput("context", context);
    fixture.componentRef.setInput("teammate", teammate);
    fixture.detectChanges();
    return fixture;
  };
  const gaugeOf = (fixture: ComponentFixture<ContextGaugeComponent>): HTMLElement => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>("[role='meter']")!;
  const part = (fixture: ComponentFixture<ContextGaugeComponent>, name: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`.nol-teamrun-context-${name}`);

  it("reads out how full the session is and where it compacts, as a meter that takes focus", () => {
    const gauge = gaugeOf(render(new ContextUsage(172_000, 200_000, 180_000)));

    expect([gauge.getAttribute("aria-valuemin"), gauge.getAttribute("aria-valuemax"), gauge.getAttribute("aria-valuenow"), gauge.getAttribute("aria-valuetext")])
      .toEqual(["0", "100", "86", "Context 86%"]);
    expect(gauge.getAttribute("aria-label")).toBe("Ada's session holds 172,000 of 200,000 tokens. It compacts at 90%.");
    expect(gauge.textContent?.trim()).toBe("Context 86%");
    expect(gauge.tabIndex).toBe(0);
    expect(gauge.querySelector(".nol-teamrun-context-track")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows the figure and the detail as a tooltip", async () => {
    const gauge = gaugeOf(render(new ContextUsage(9_500, 128_000, null), "Codex"));

    await userEvent.hover(gauge);
    await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toBe("Context 7%. Codex's session holds 9,500 of 128,000 tokens."));
    await userEvent.unhover(gauge);
  });

  it("shows its track alone when told, with the figure in its tooltip and accessible name, and measures its whole and track-alone widths the same either way", () => {
    const fixture = render(new ContextUsage(172_000, 200_000, 180_000));
    const gauge = fixture.componentInstance;
    const meter = gaugeOf(fixture);
    const whole = meter.getBoundingClientRect().width;
    const alone = gauge.trackWidth();
    expect([gauge.fullWidth(), meter.classList.contains("nol-teamrun-context-track-only")]).toEqual([expect.closeTo(whole, 1), false]);

    fixture.componentRef.setInput("trackOnly", true);
    fixture.detectChanges();
    const track = part(fixture, "track")!;
    const inset = Number.parseFloat(getComputedStyle(track).marginInlineStart);
    expect([gauge.fullWidth(), getComputedStyle(part(fixture, "text")!).visibility, getComputedStyle(track).visibility, gauge.labelElement, meter.getAttribute("aria-label"),
      meter.getAttribute("aria-valuetext")]).toEqual([expect.closeTo(whole, 1), "hidden", "visible", part(fixture, "text"),
      "Context 86%. Ada's session holds 172,000 of 200,000 tokens. It compacts at 90%.", "Context 86%"]);
    expect([meter.getBoundingClientRect().width, gauge.trackWidth()]).toEqual([expect.closeTo(track.getBoundingClientRect().width + inset * 2, 1), expect.closeTo(alone, 1)]);
    expect(alone).toBeCloseTo(meter.getBoundingClientRect().width, 1);
  });

  it("marks no compact point when the provider doesn't send one, and follows a new figure", () => {
    const fixture = render(new ContextUsage(9_500, 128_000, null));
    expect(part(fixture, "compact")).toBeNull();
    expect(gaugeOf(fixture).textContent?.trim()).toBe("Context 7%");

    fixture.componentRef.setInput("context", new ContextUsage(64_000, 128_000, 120_000));
    fixture.detectChanges();
    expect(part(fixture, "compact")).not.toBeNull();
    expect(gaugeOf(fixture).textContent?.trim()).toBe("Context 50%");
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const middle = (rect: DOMRect): number => rect.top + rect.height / 2;

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("fills the track to the share in use, marks the compact point along it, and sets the label after it on one line", () => {
      const fixture = render(new ContextUsage(172_000, 200_000, 180_000));
      const gauge = gaugeOf(fixture);
      const [track, fill, compact, text] = [part(fixture, "track")!, part(fixture, "fill")!, part(fixture, "compact")!, part(fixture, "text")!];

      AppearanceFixture.expectPixels(box(track).width, AppearanceFixture.measureLook("space-6"));
      AppearanceFixture.expectPixels(box(track).height, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(box(track).left - box(gauge).left, AppearanceFixture.measureLook("space-1"));
      const inner = box(track).left + track.clientLeft;
      const [innerWidth, innerHeight] = [box(track).width - track.clientLeft * 2, box(track).height - track.clientTop * 2];
      AppearanceFixture.expectPixels(box(fill).left, inner);
      expect(Math.abs(box(fill).width - innerWidth * 0.86)).toBeLessThan(1);
      expect(Math.abs(box(compact).left - (inner + innerWidth * 0.9))).toBeLessThan(1);
      AppearanceFixture.expectPixels(box(compact).width, AppearanceFixture.measureLook("border-width"));
      AppearanceFixture.expectPixels(box(compact).height, innerHeight);
      AppearanceFixture.expectPixels(box(fill).height, innerHeight);
      AppearanceFixture.expectPixels(box(text).left - box(track).right, AppearanceFixture.measureLook("space-1"));
      expect(Math.abs(middle(box(track)) - middle(box(text)))).toBeLessThanOrEqual(1);
      expect(Math.abs(middle(box(gauge)) - middle(box(text)))).toBeLessThanOrEqual(1);
      expect(box(gauge).height).toBeGreaterThanOrEqual(24);
      expect(box(text).height).toBeLessThan(box(text).width);
      expect(getComputedStyle(fill).backgroundColor).not.toBe(getComputedStyle(track).backgroundColor);
      expect(getComputedStyle(compact).backgroundColor).not.toBe(getComputedStyle(fill).backgroundColor);
      if (forcedColors === "active")
        expect(getComputedStyle(track).borderTopStyle).toBe("solid");
    });

    it("stops the fill at the track's end when the session holds more than its window", () => {
      const fixture = render(new ContextUsage(250_000, 200_000, null));
      const [track, fill] = [part(fixture, "track")!, part(fixture, "fill")!];

      AppearanceFixture.expectPixels(box(fill).width, box(track).width - track.clientLeft * 2);
      expect(gaugeOf(fixture).textContent?.trim()).toBe("Context 100%");
    });

    it("outlines the gauge when it takes focus from the keyboard", async () => {
      const fixture = render(new ContextUsage(1, 2, null));
      const gauge = gaugeOf(fixture);
      document.body.tabIndex = -1;
      document.body.focus();
      await userEvent.tab();

      expect(document.activeElement).toBe(gauge);
      expect(getComputedStyle(gauge).outlineStyle).toBe("solid");
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(gauge).outlineWidth), AppearanceFixture.measureLook("border-width") * 2);
      document.body.removeAttribute("tabindex");
    });
  });
});
