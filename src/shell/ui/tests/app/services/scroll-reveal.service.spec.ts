/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { AppearanceService } from "../../../src/app/services/appearance.service";
import { ScrollRevealService } from "../../../src/app/services/scroll-reveal.service";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";
import { MotionFixture } from "../../fixtures/motion.fixture";

describe("ScrollRevealService", () => {
  const hidden = "rgba(0, 0, 0, 0)";
  let area: HTMLElement;
  let rest: HTMLElement;
  let shown: string;

  beforeEach(async () => {
    AppearanceFixture.apply();
    TestBed.inject(ScrollRevealService);
    area = document.body.appendChild(document.createElement("div"));
    area.tabIndex = 0;
    area.style.cssText = "position: fixed; top: 0; left: 0; width: 200px; height: 120px; overflow: auto;";
    area.appendChild(document.createElement("div")).style.cssText = "height: 2000px;";
    rest = document.body.appendChild(document.createElement("div"));
    rest.style.cssText = "position: fixed; top: 0; left: 300px; width: 100px; height: 100px;";
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.color = "var(--tr-scrollbar)";
    shown = getComputedStyle(probe).color;
    probe.remove();
    await userEvent.hover(rest);
    await MotionFixture.reduceAsync();
  });

  afterEach(async () => {
    vi.useRealTimers();
    area.remove();
    rest.remove();
    await MotionFixture.resetAsync();
    AppearanceFixture.reset();
  });

  function scrolled(element: HTMLElement): Promise<Event> {
    return new Promise(resolve => element.addEventListener("scroll", resolve, { once: true }));
  }

  function thumb(element: HTMLElement): string {
    return getComputedStyle(element).getPropertyValue("--tr-scroll-thumb");
  }

  function isScrolling(element: HTMLElement): boolean {
    return element.hasAttribute("data-tr-scrolling");
  }

  function transitions(element: HTMLElement): CSSTransition[] {
    return element.getAnimations().filter(t => t instanceof CSSTransition);
  }

  function useFakeClock(): void {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  }

  it("shows an area's thumb while the keyboard scrolls it, with the pointer elsewhere, and hides it 1 s after the last scroll", async () => {
    useFakeClock();
    area.focus();
    const scroll = scrolled(area);
    await userEvent.keyboard("{PageDown}");
    await scroll;

    expect([area.scrollTop > 0, isScrolling(area), thumb(area)]).toEqual([true, true, shown]);
    vi.advanceTimersByTime(999);
    expect(isScrolling(area)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isScrolling(area)).toBe(false);
  });

  it("keeps the thumb shown after a wheel scroll once the pointer has moved away, then hides it", async () => {
    useFakeClock();
    const scroll = scrolled(area);
    await userEvent.wheel(area, { delta: { y: 200 } });
    await scroll;
    await userEvent.hover(rest);

    expect([area.matches(":hover"), isScrolling(area), thumb(area)]).toEqual([false, true, shown]);
    vi.advanceTimersByTime(1000);
    expect(isScrolling(area)).toBe(false);
  });

  it("keeps the thumb shown while scrolling continues and hides it 1 s after the last scroll", async () => {
    useFakeClock();
    for (const top of [100, 200, 300]) {
      const scroll = scrolled(area);
      area.scrollTop = top;
      await scroll;
      vi.advanceTimersByTime(800);
      expect(isScrolling(area)).toBe(true);
    }

    vi.advanceTimersByTime(199);
    expect(isScrolling(area)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isScrolling(area)).toBe(false);
  });

  it("fades the thumb in while the area scrolls and out over 150 ms once scrolling stops", async () => {
    await MotionFixture.resetAsync();
    useFakeClock();
    const scroll = scrolled(area);
    area.scrollTop = 100;
    await scroll;
    const fadeIn = transitions(area);
    await Promise.all(fadeIn.map(t => t.finished));
    const revealed = thumb(area);
    vi.advanceTimersByTime(1000);
    const fadeOut = transitions(area);

    const style = getComputedStyle(area);
    expect([style.transitionDuration, style.transitionTimingFunction, fadeIn.map(t => t.transitionProperty), revealed, isScrolling(area), fadeOut.map(t => t.transitionProperty)])
      .toEqual(["0.15s", "linear", ["--tr-scroll-thumb"], shown, false, ["--tr-scroll-thumb"]]);
    await Promise.all(fadeOut.map(t => t.finished));
    expect(thumb(area)).toBe(hidden);
  });

  it("marks only the nested area that scrolls, not the area around it", async () => {
    useFakeClock();
    const inner = area.insertBefore(document.createElement("div"), area.firstChild);
    inner.style.cssText = "height: 60px; overflow: auto;";
    inner.appendChild(document.createElement("div")).style.cssText = "height: 600px;";
    const innerScroll = scrolled(inner);
    inner.scrollTop = 100;
    await innerScroll;

    expect([isScrolling(inner), thumb(inner), isScrolling(area), thumb(area)]).toEqual([true, shown, false, hidden]);
    vi.advanceTimersByTime(1000);
    const outerScroll = scrolled(area);
    area.scrollTop = 100;
    await outerScroll;
    expect([isScrolling(inner), thumb(inner), isScrolling(area), thumb(area)]).toEqual([false, hidden, true, shown]);
  });

  it("hides the thumb at once, without the fade, when reduced motion is preferred", async () => {
    useFakeClock();
    const scroll = scrolled(area);
    area.scrollTop = 100;
    await scroll;

    expect(thumb(area)).toBe(shown);
    vi.advanceTimersByTime(1000);
    expect([getComputedStyle(area).transitionDuration, isScrolling(area), thumb(area)]).toEqual(["0s", false, hidden]);
  });

  it("keeps the thumb under the pointer once scrolling stops", async () => {
    useFakeClock();
    await userEvent.hover(area);
    const scroll = scrolled(area);
    area.scrollTop = 100;
    await scroll;
    vi.advanceTimersByTime(1000);

    expect([isScrolling(area), area.matches(":hover")]).toEqual([false, true]);
  });

  it("never marks an area that doesn't scroll", async () => {
    const still = document.body.appendChild(document.createElement("div"));
    still.style.cssText = "position: fixed; top: 200px; left: 0; width: 200px; height: 120px; overflow: auto;";
    try {
      const scroll = scrolled(area);
      await userEvent.wheel(still, { delta: { y: 200 } });
      await userEvent.hover(rest);
      area.scrollTop = 100;
      await scroll;

      expect([isScrolling(still), thumb(still), isScrolling(area)]).toEqual([false, hidden, true]);
    }
    finally {
      still.remove();
    }
  });

  it("releases an area removed while it scrolls once its second has passed", async () => {
    useFakeClock();
    const scroll = scrolled(area);
    area.scrollTop = 100;
    await scroll;
    area.remove();

    expect([isScrolling(area), vi.getTimerCount()]).toEqual([true, 1]);
    vi.advanceTimersByTime(1000);
    expect([isScrolling(area), vi.getTimerCount()]).toEqual([false, 0]);
  });

  it("hides the thumb of an area put back while it scrolls after its second, and shows it again on the next scroll", async () => {
    useFakeClock();
    const scroll = scrolled(area);
    area.scrollTop = 100;
    await scroll;
    area.remove();
    document.body.append(area);
    vi.advanceTimersByTime(1000);

    expect([isScrolling(area), vi.getTimerCount()]).toEqual([false, 0]);
    const again = scrolled(area);
    area.scrollTop = 200;
    await again;
    expect([isScrolling(area), thumb(area)]).toEqual([true, shown]);
  });

  it("stops listening and clears its marks when the application ends", async () => {
    useFakeClock();
    const scroll = scrolled(area);
    area.scrollTop = 100;
    await scroll;
    TestBed.resetTestingModule();

    expect([isScrolling(area), vi.getTimerCount()]).toEqual([false, 0]);
    const later = scrolled(area);
    area.scrollTop = 200;
    await later;
    expect(isScrolling(area)).toBe(false);
  });

  it("starts with the appearance service, so every window has it", async () => {
    TestBed.resetTestingModule();
    TestBed.inject(AppearanceService);
    const scroll = scrolled(area);
    area.scrollTop = 100;
    await scroll;

    expect(isScrolling(area)).toBe(true);
  });

  it("marks the root when the document itself scrolls", async () => {
    const tall = document.body.appendChild(document.createElement("div"));
    tall.style.height = "5000px";
    try {
      const scroll = new Promise(resolve => document.addEventListener("scroll", resolve, { once: true }));
      window.scrollTo(0, 100);
      await scroll;

      expect(isScrolling(document.documentElement)).toBe(true);
    }
    finally {
      window.scrollTo(0, 0);
      tall.remove();
    }
  });
});
