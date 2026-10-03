/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusMonitor } from "@angular/cdk/a11y";
import { Component, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { TooltipDirective } from "../../../../src/app/components/tooltip/tooltip.directive";
import { OverlaySide } from "../../../../src/app/models/overlay-side";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [TooltipDirective],
  template: `
    <div class="frame" [attr.data-tr-chrome]="chrome()" style="position: fixed; top: 300px; left: 400px; padding: 20px;">
      <button type="button" class="anchor" [style.width]="width()" [trTooltip]="text()" [trTooltipSide]="side()"
        [trTooltipDisabled]="isDisabled()" [trTooltipTruncated]="isTruncatedOnly()" [trTooltipBeside]="beside()">
        <span data-truncates style="display: block; overflow: hidden; white-space: nowrap;">{{ text() }}</span>
      </button>
    </div>
    <button type="button" class="other">Other</button>
  `
})
class TooltipHostComponent {
  public readonly text = signal("Split the group to the right");
  public readonly side = signal(OverlaySide.above);
  public readonly isDisabled = signal(false);
  public readonly isTruncatedOnly = signal(false);
  public readonly width = signal("auto");
  public readonly chrome = signal<string | null>(null);
  public readonly beside = signal<string | null>(null);
  public readonly tooltip = viewChild.required(TooltipDirective);
}

describe("TooltipDirective", () => {
  let fixture: ComponentFixture<TooltipHostComponent>;
  let host: TooltipHostComponent;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(TooltipHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    AppearanceFixture.reset();
  });

  function anchor(): HTMLElement {
    return fixture.nativeElement.querySelector(".anchor");
  }

  function tooltip(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".cdk-overlay-container tr-tooltip");
  }

  function update(change: () => void): void {
    change();
    fixture.detectChanges();
  }

  async function shownAsync(): Promise<HTMLElement> {
    await vi.waitFor(() => expect(tooltip()).not.toBeNull());
    await fixture.whenStable();
    await new Promise(resolve => requestAnimationFrame(resolve));
    return tooltip() ?? anchor();
  }

  function gap(): number {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5;
  }

  it("shows its text above its anchor on hover, as a tooltip that describes the anchor", async () => {
    await userEvent.hover(anchor());
    const shown = await shownAsync();
    const box = shown.getBoundingClientRect();
    const target = anchor().getBoundingClientRect();

    expect(shown.textContent?.trim()).toBe("Split the group to the right");
    expect(shown.getAttribute("role")).toBe("tooltip");
    expect(target.top - box.bottom).toBeCloseTo(gap(), 0);
    expect(box.left + box.width / 2).toBeCloseTo(target.left + target.width / 2, 0);
    const described = anchor().getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(described)?.textContent).toBe("Split the group to the right");
  });

  for (const [name, side, measure] of [
    ["below", OverlaySide.below, (tip: DOMRect, target: DOMRect): number => tip.top - target.bottom],
    ["before", OverlaySide.start, (tip: DOMRect, target: DOMRect): number => target.left - tip.right],
    ["after", OverlaySide.end, (tip: DOMRect, target: DOMRect): number => tip.left - target.right]
  ] as const)
    it(`places itself ${name} its anchor, a gap away`, async () => {
      update(() => host.side.set(side));
      host.tooltip().show();
      const shown = await shownAsync();

      expect(measure(shown.getBoundingClientRect(), anchor().getBoundingClientRect())).toBeCloseTo(gap(), 0);
    });

  it("stays while the pointer moves onto it and hides once it leaves both", async () => {
    await userEvent.hover(anchor());
    const shown = await shownAsync();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      anchor().dispatchEvent(new PointerEvent("pointerleave", { relatedTarget: shown }));
      vi.runAllTimers();
      expect(tooltip()).not.toBeNull();
      shown.parentElement?.dispatchEvent(new PointerEvent("pointerleave", { relatedTarget: anchor() }));
      vi.runAllTimers();
      expect(tooltip()).not.toBeNull();
      shown.parentElement?.dispatchEvent(new PointerEvent("pointerleave", { relatedTarget: document.body }));
      vi.runAllTimers();

      expect(tooltip()).toBeNull();
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("shows nothing when the pointer passes over its anchor before the tooltip ever opened", async () => {
    await userEvent.hover(fixture.nativeElement.querySelector(".other"));
    const fresh = TestBed.createComponent(TooltipHostComponent);
    fresh.detectChanges();
    const target: HTMLElement = fresh.nativeElement.querySelector(".anchor");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    target.dispatchEvent(new PointerEvent("pointerenter"));
    target.dispatchEvent(new PointerEvent("pointerleave", { relatedTarget: document.body }));
    target.dispatchEvent(new PointerEvent("pointerenter"));
    target.dispatchEvent(new PointerEvent("pointerleave"));
    vi.runAllTimers();
    vi.useRealTimers();
    const shown = tooltip();
    fresh.destroy();

    expect(shown).toBeNull();
  });

  it("hides when something around its anchor scrolls it away, but not for a scroll that leaves it in place", async () => {
    host.tooltip().show();
    await shownAsync();
    fixture.nativeElement.dispatchEvent(new Event("scroll"));
    const isShownAfterStill = !Object.isNull(tooltip());

    fixture.nativeElement.querySelector(".frame").style.top = "320px";
    fixture.nativeElement.dispatchEvent(new Event("scroll"));

    expect(isShownAfterStill).toBe(true);
    expect(tooltip()).toBeNull();
  });

  for (const [name, side] of [["beside", OverlaySide.end], ["above", OverlaySide.above]] as const)
    it(`keeps ${name} the enclosing element it is told to keep clear of, a gap away`, async () => {
      update(() => {
        host.beside.set(".frame");
        host.side.set(side);
      });
      host.tooltip().show();
      const shown = (await shownAsync()).getBoundingClientRect();
      const frame = fixture.nativeElement.querySelector(".frame").getBoundingClientRect();

      expect(side.isVertical ? frame.top - shown.bottom : shown.left - frame.right).toBeCloseTo(gap(), 0);
    });

  it("keeps clear of its anchor alone when nothing around it matches", async () => {
    update(() => host.beside.set(".missing"));
    host.tooltip().show();
    const shown = (await shownAsync()).getBoundingClientRect();

    expect(anchor().getBoundingClientRect().top - shown.bottom).toBeCloseTo(gap(), 0);
  });

  it("hides when the pointer leaves the anchor for elsewhere and when the anchor is pressed", async () => {
    await userEvent.hover(anchor());
    await shownAsync();
    await userEvent.hover(fixture.nativeElement.querySelector(".other"));
    await vi.waitFor(() => expect(tooltip()).toBeNull());

    host.tooltip().show();
    await shownAsync();
    anchor().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(tooltip()).toBeNull();
  });

  it("dismisses a hover tooltip with Escape while focus is elsewhere, without moving focus", async () => {
    const other: HTMLElement = fixture.nativeElement.querySelector(".other");
    other.tabIndex = -1;
    other.focus();
    await userEvent.hover(anchor());
    await shownAsync();

    await userEvent.keyboard("{Escape}");

    expect(tooltip()).toBeNull();
    expect(document.activeElement).toBe(other);
  });

  it("shows on keyboard focus, hides on blur and dismisses with Escape without letting it reach the page", async () => {
    const escapes: KeyboardEvent[] = [];
    document.addEventListener("keydown", t => escapes.push(t));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(anchor());
    await shownAsync();

    await userEvent.keyboard("{Escape}");
    expect(tooltip()).toBeNull();
    expect(escapes.filter(t => t.key === "Escape")).toEqual([]);
    await userEvent.keyboard("{Escape}");
    expect(escapes.filter(t => t.key === "Escape").length).toBe(1);

    host.tooltip().show();
    await shownAsync();
    await userEvent.keyboard("{Tab}");
    await vi.waitFor(() => expect(tooltip()).toBeNull());
  });

  it("does not show on a focus that does not come from the keyboard", async () => {
    const origins: (string | null)[] = [];
    const watching = TestBed.inject(FocusMonitor).monitor(anchor()).subscribe(t => origins.push(t));

    anchor().focus();
    await vi.waitFor(() => expect(origins).toEqual(["program"]));
    watching.unsubscribe();

    expect(tooltip()).toBeNull();
  });

  it("follows a changed text while shown and stops describing the anchor when it is destroyed", async () => {
    host.tooltip().show();
    await shownAsync();
    update(() => host.text.set("Split the group downward"));
    await fixture.whenStable();

    expect(tooltip()?.textContent?.trim()).toBe("Split the group downward");
    const described = anchor().getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(described)?.textContent).toBe("Split the group downward");
    const element = anchor();
    fixture.destroy();
    expect(tooltip()).toBeNull();
    expect(element.hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows nothing while disabled and hides when it becomes disabled", async () => {
    host.tooltip().show();
    await shownAsync();
    update(() => host.isDisabled.set(true));
    await fixture.whenStable();
    expect(tooltip()).toBeNull();

    host.tooltip().show();
    expect(tooltip()).toBeNull();
  });

  it("shows only while its marked text is truncated when asked, without describing the anchor", async () => {
    update(() => host.isTruncatedOnly.set(true));
    await fixture.whenStable();
    host.tooltip().show();
    expect(tooltip()).toBeNull();
    expect(anchor().hasAttribute("aria-describedby")).toBe(false);

    update(() => host.width.set("4rem"));
    host.tooltip().show();
    await shownAsync();
  });

  it("measures truncation on the anchor itself when nothing inside is marked", async () => {
    update(() => host.isTruncatedOnly.set(true));
    anchor().querySelector("[data-truncates]")?.removeAttribute("data-truncates");
    update(() => host.width.set("auto"));
    host.tooltip().show();

    expect(tooltip()).toBeNull();
  });

  it("keeps below the top chrome and above the bottom chrome, except next to its own chrome", async () => {
    const root = getComputedStyle(document.documentElement);
    const rem = parseFloat(root.fontSize);
    const rowHeight = parseFloat(root.getPropertyValue("--tr-window-row-height")) * rem;
    const container = anchor().parentElement as HTMLElement;
    container.style.top = "2px";
    host.tooltip().show();
    const pushed = await shownAsync();
    expect(pushed.getBoundingClientRect().top).toBeGreaterThanOrEqual(rowHeight + gap() - 0.5);
    host.tooltip().hide();

    update(() => host.chrome.set("top"));
    update(() => host.side.set(OverlaySide.below));
    host.tooltip().show();
    const below = await shownAsync();

    expect(below.getBoundingClientRect().top - anchor().getBoundingClientRect().bottom).toBeCloseTo(gap(), 0);
  });
});
