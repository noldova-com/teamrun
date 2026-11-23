/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { EventName, Message, MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { OrganizationCardComponent } from "../../../../src/app/components/organization-card/organization-card.component";
import { OrganizationCardField } from "../../../../src/app/enums/organization-card-field";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { OrganizationScope } from "../../../../src/app/services/organization-scope";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { ThemeCase } from "../../../fixtures/theme-case.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationCardComponent's layout", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationCardComponent>;
  const clock = new FakeClock(Date.parse("2026-09-10T08:05:00.000Z"));
  let sized: HTMLElement | null = null;

  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The fixture has no element.");
    return native;
  };
  const one = (selector: string): HTMLElement => {
    const found = element().querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const host = (): HTMLElement => {
    const parent = element().parentElement;
    if (Object.isNull(parent))
      throw new Error("The card has no parent.");
    return parent;
  };
  const box = (view: Element): DOMRect => view.getBoundingClientRect();
  const avatar = (): HTMLElement => one("nol-teamrun-teammate-avatar > *");
  const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
  const rem = (): number => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const lines = (view: Element): number => {
    const range = document.createRange();
    range.selectNodeContents(view);
    return new Set([...range.getClientRects()].filter(t => t.width > 0).map(t => Math.round(t.top))).size;
  };
  const reply = (id: string, chatId: string, started: number): Message => {
    const at = new Date(started).toISOString();
    return new Message(id, chatId, 1, MessageAuthor.Provider, null, MessageStatus.Running, [], SampleData.provenance, at, at, null, [], "alice", "alice");
  };
  const create = async (): Promise<void> => {
    context = SampleData.createContext();
    const data = new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ClockService, useValue: clock }] });
    fixture = TestBed.createComponent(OrganizationCardComponent);
    fixture.componentRef.setInput("teammate", data.alice);
    fixture.autoDetectChanges();
    sized = host();
    sized.style.width = "30rem";
    new OrganizationLayoutService(context, new OrganizationScope()).showOnEveryCard(OrganizationCardField.Model, true);
    await Wait.until(() => expect(element().querySelector(".model")).not.toBeNull());
    await settle();
  };

  afterEach(() => {
    if (!Object.isNull(sized))
      sized.style.removeProperty("width");
    sized = null;
    TeammateStatusStoreService.release(context);
    OrganizationLayoutService.release(context);
    ChatStoreService.release(context);
  });

  it("offers You as the place of a teammate the organization places nowhere while it is edited", async () => {
    await create();
    fixture.componentRef.setInput("editing", true);
    await settle();

    expect(element().querySelector(".move-choice .nol-select-value")?.textContent?.trim()).toBe("You");
  });

  describe.each(ThemeCase.every)("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("sizes a card to 15rem with the fields under its head", async () => {
      await create();
      const head = one(".head");

      AppearanceFixture.expectPixels(box(element()).width, 15 * rem());
      AppearanceFixture.expectPixels(box(avatar()).left - box(element()).left, space(3) + 1);
      AppearanceFixture.expectPixels(box(one(".status")).top - box(head).bottom, space(2));
      AppearanceFixture.expectPixels(box(one(".status")).left, box(head).left);
    });

    it("keeps the activity word whole beside a long elapsed time, moving the time to its own line under the word", async () => {
      await create();
      element().style.width = "13.25rem";
      context.emit(EventName.MessageCreated, reply("r1", "c9", clock.now() - (1750 * 3600 + 20 * 60) * 1000).toJson());
      context.emit(EventName.MessageCreated, reply("r2", "c8", clock.now() - 3600 * 1000).toJson());
      await Wait.until(() => expect(one(".now-for").textContent).toBe("1750 h 20 min +1"));
      await settle();
      const text = one(".now-text");
      const time = one(".now-for");

      expect([text.textContent, lines(text), lines(time)]).toEqual(["Replying", 1, 1]);
      AppearanceFixture.expectPixels(box(time).left, box(text).left);
      expect(box(time).top).toBeGreaterThanOrEqual(box(text).bottom - 1);
      expect(box(time).right).toBeLessThanOrEqual(box(element()).right - space(3));

      text.textContent = "Replying".repeat(8);
      AppearanceFixture.expectPixels(box(text).right, box(element()).right - space(3) - 1);
      expect(lines(text)).toBeGreaterThan(1);
    });
  });
});
