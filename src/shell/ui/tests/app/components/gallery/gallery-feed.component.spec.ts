/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { GalleryFeedComponent } from "../../../../src/app/components/gallery/gallery-feed.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/models/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

describe("GalleryFeedComponent", () => {
  let fixture: ComponentFixture<GalleryFeedComponent>;

  async function settleAsync(): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      await fixture.whenStable();
      await new Promise<void>(t => requestAnimationFrame(() => requestAnimationFrame(() => t())));
    }
    await fixture.whenStable();
  }

  async function renderAsync(): Promise<void> {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    fixture = TestBed.createComponent(GalleryFeedComponent);
    await settleAsync();
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const viewport = (): HTMLElement => element().querySelector(".tr-virtual-list-viewport") as HTMLElement;
  const articles = (): HTMLElement[] => [...element().querySelectorAll<HTMLElement>("[role=article]")];
  const last = (): HTMLElement => articles().find(t => t.getAttribute("aria-posinset") === t.getAttribute("aria-setsize")) as HTMLElement;
  const stream = (): HTMLElement => element().querySelector("button.tr-button") as HTMLElement;

  afterEach(() => {
    vi.useRealTimers();
    AppearanceFixture.reset();
  });

  it("shows a conversation of 10,000 messages at its end, each named by its heading, with code samples among them", async () => {
    await renderAsync();
    const heading = document.getElementById(last().getAttribute("aria-labelledby") ?? String.empty);

    expect([element().querySelector("[role=feed]")?.getAttribute("aria-label"), last().getAttribute("aria-setsize"), heading?.textContent]).toEqual(["Gallery conversation", "10000", "Ada · message 10000"]);
    expect([element().querySelector("tr-code-block") !== null, articles().length < 40, Math.round(viewport().scrollHeight - viewport().clientHeight - viewport().scrollTop)]).toEqual([true, true, 0]);
  });

  it("streams a reply word by word at its end, which the feed follows", async () => {
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    await userEvent.click(stream());
    await vi.advanceTimersByTimeAsync(4000);
    await settleAsync();
    const text = last().querySelector(".tr-gallery-message-text")?.textContent ?? String.empty;

    expect([last().getAttribute("aria-setsize"), text.split(" ").length, vi.getTimerCount(), Math.round(viewport().scrollHeight - viewport().clientHeight - viewport().scrollTop)]).toEqual(["10001", 40, 0, 0]);
  });

  it("stops a reply that is still streaming once it is destroyed", async () => {
    await renderAsync();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    await userEvent.click(stream());
    const streaming = vi.getTimerCount();
    fixture.destroy();

    expect([streaming, vi.getTimerCount()]).toEqual([1, 0]);
  });
});
