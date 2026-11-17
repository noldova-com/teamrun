/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { Conversation, MessagePage, MethodName } from "@noldova/teamrun.protocol";
import { provideCodeHighlighting } from "@noldova/ui.components.angular/code-highlighting";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { FakeClock } from "../../fixtures/fake-clock.fixture";
import type { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { HistoryComponent } from "../../../src/app/components/history/history.component";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { ClockService } from "../../../src/app/services/clock.service";
import { Resources } from "../../../src/resources";

describe("HistoryWarmUpService", () => {
  const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
  const idle: IdleDeadline = { didTimeout: false, timeRemaining: () => 50 };
  let context: FakeWindowPartContext;
  let idles: IdleRequestCallback[];
  let cancelled: number[];

  const row = "nol-teamrun-history-message";
  const holder = (): HTMLElement | null => document.querySelector<HTMLElement>(Resources.historyWarmUpTag);
  const frame = (): Promise<void> => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const open = async (chatId: string): Promise<ComponentFixture<HistoryComponent>> => {
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.componentRef.setInput("chatId", chatId);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  beforeEach(() => {
    idles = [];
    cancelled = [];
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback): number => idles.push(callback));
    vi.stubGlobal("cancelIdleCallback", (request: number): void => {
      cancelled.push(request);
    });
    AppearanceFixture.apply();
    context = SampleData.createContext()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()])
      .answer(MethodName.MessagePage, () => new MessagePage([], false, false, 0).toJson());
    TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: signal(true) }, ChatStoreService.provider,
        { provide: ClockService, useValue: new FakeClock(Date.parse(SampleData.timestamp)) }, provideMarkdown(), provideCodeHighlighting()]
    });
  });

  afterEach(() => {
    ChatStoreService.release(context);
    AppearanceFixture.reset();
    vi.unstubAllGlobals();
  });

  it("renders a question and a reply once the window is idle, off screen, hidden from the reader and from focus, and removes them by the next frame", async () => {
    const fixture = await open("c1");
    expect([idles.length, holder()]).toEqual([1, null]);

    idles[0]?.(idle);
    const shown = holder();
    const rows = [...shown?.querySelectorAll<HTMLElement>(row) ?? []];
    const parts = [...shown?.querySelectorAll<HTMLElement>("*") ?? []];
    const focused = parts.filter(t => {
      t.focus();
      return document.activeElement === t;
    });

    expect({
      rows: rows.map(t => !Object.isNull(t.querySelector("nol-message"))),
      hidden: shown?.getAttribute("aria-hidden"),
      inert: shown?.inert,
      visibility: Object.isNull(shown) ? null : getComputedStyle(shown).visibility,
      onScreen: [shown, ...parts].filter(t => !Object.isNull(t) && t.getBoundingClientRect().right > 0).length,
      focused: focused.length,
      inFeed: (fixture.nativeElement as HTMLElement).querySelectorAll(row).length
    }).toEqual({ rows: [true, true], hidden: "true", inert: true, visibility: "hidden", onScreen: 0, focused: 0, inFeed: 0 });

    await frame();
    expect([holder(), document.querySelectorAll(row).length]).toEqual([null, 0]);
  });

  it("never warms up again for a second chat in the same window", async () => {
    await open("c1");
    idles[0]?.(idle);
    await frame();

    await open("c2");
    expect([idles.length, holder()]).toEqual([1, null]);
  });

  it("hands the warm-up to a chat still open when the chat that asked closes before the window is idle", async () => {
    const first = await open("c1");
    await open("c2");
    expect(idles).toHaveLength(1);

    first.destroy();
    expect([cancelled, idles.length, holder()]).toEqual([[1], 2, null]);

    idles[1]?.(idle);
    expect(holder()?.querySelectorAll(row).length).toBe(2);
  });

  it("waits for the next chat when the only chat closes before the window is idle", async () => {
    const first = await open("c1");
    first.destroy();
    expect([cancelled, idles.length, holder()]).toEqual([[1], 1, null]);

    await open("c2");
    idles[1]?.(idle);
    expect([idles.length, holder()?.querySelectorAll(row).length]).toEqual([2, 2]);
  });

  it("removes the rows at once when the chat closes before the next frame", async () => {
    const fixture = await open("c1");
    idles[0]?.(idle);
    expect(holder()).not.toBeNull();

    fixture.destroy();
    expect([holder(), document.querySelectorAll(row).length]).toEqual([null, 0]);
  });
});
