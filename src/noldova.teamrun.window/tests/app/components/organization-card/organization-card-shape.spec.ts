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
import { OrganizationCardShape } from "../../../../src/app/enums/organization-card-shape";
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

describe("OrganizationCardComponent's shapes", () => {
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
  const create = async (shape: OrganizationCardShape | null): Promise<void> => {
    context = SampleData.createContext();
    const data = new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ClockService, useValue: clock }] });
    fixture = TestBed.createComponent(OrganizationCardComponent);
    fixture.componentRef.setInput("teammate", data.alice);
    if (!Object.isNull(shape))
      fixture.componentRef.setInput("shape", shape);
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

  it("is a card unless told otherwise, and takes each shape's class", async () => {
    await create(null);
    const classes = (): boolean[] => [element().classList.contains("fluid"), element().classList.contains("row")];
    const kept = classes();
    fixture.componentRef.setInput("shape", OrganizationCardShape.Fluid);
    await settle();
    const fluid = classes();
    fixture.componentRef.setInput("shape", OrganizationCardShape.Row);
    await settle();

    expect([kept, fluid, classes()]).toEqual([[false, false], [true, false], [false, true]]);
  });

  describe.each(ThemeCase.every)("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("sizes a card to 15rem with the fields under its head", async () => {
      await create(OrganizationCardShape.Card);
      const head = one(".head");

      AppearanceFixture.expectPixels(box(element()).width, 15 * rem());
      AppearanceFixture.expectPixels(box(avatar()).left - box(element()).left, space(3) + 1);
      AppearanceFixture.expectPixels(box(one(".status")).top - box(head).bottom, space(2));
      AppearanceFixture.expectPixels(box(one(".status")).left, box(head).left);
    });

    it("widens a fluid card to its container, with the card's own insets", async () => {
      await create(OrganizationCardShape.Fluid);

      AppearanceFixture.expectPixels(box(element()).width, 30 * rem());
      AppearanceFixture.expectPixels(box(avatar()).left - box(element()).left, space(3) + 1);
      AppearanceFixture.expectPixels(box(element()).right - box(one(".tune")).right, space(3) + 1);
    });

    it("keeps the activity word whole beside a long elapsed time, moving the time to its own line under the word, as a card and fluid", async () => {
      await create(OrganizationCardShape.Card);
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

      fixture.componentRef.setInput("shape", OrganizationCardShape.Fluid);
      element().style.width = "";
      host().style.width = "13.25rem";
      await Wait.until(() => expect(element().querySelectorAll(".act")).toHaveLength(2));
      await settle();
      const part = (activity: number, selector: string): HTMLElement => one(`.act:nth-child(${activity}) ${selector}`);
      const parts = [part(1, ".now-text"), part(1, ".now-for"), part(2, ".now-text"), part(2, ".now-for")];

      expect(parts.map(t => [t.textContent, lines(t)])).toEqual([["Replying", 1], ["1750 h 20 min", 1], ["Replying", 1], ["1 h 0 min", 1]]);
      AppearanceFixture.expectPixels(box(part(1, ".now-for")).left, box(part(1, ".now-text")).left);
      AppearanceFixture.expectPixels(box(part(2, ".now-for")).top, box(part(2, ".now-text")).top);
    });

    it("lays a row out with the avatar at the left, the name and role on one line, the fields under the name, and no border", async () => {
      await create(OrganizationCardShape.Row);
      const host = box(element());
      const face = box(avatar());
      const who = box(one(".who"));
      const tune = box(one(".tune"));
      const status = box(one(".status"));
      const model = box(one(".model"));

      AppearanceFixture.expectPixels(host.width, 30 * rem());
      expect(getComputedStyle(element()).borderTopWidth).toBe("0px");
      AppearanceFixture.expectPixels(face.left - host.left, space(2));
      AppearanceFixture.expectPixels(face.top - host.top, space(2));
      AppearanceFixture.expectPixels(who.left - face.right, space(2));
      AppearanceFixture.expectPixels(tune.left - who.right, space(2));
      AppearanceFixture.expectPixels(host.right - tune.right, space(2));
      AppearanceFixture.expectPixels(tune.top - host.top, space(2));
      AppearanceFixture.expectPixels(box(one(".role")).left - box(one(".name")).right, space(2));
      AppearanceFixture.expectPixels(status.left, who.left);
      AppearanceFixture.expectPixels(status.top - Math.max(face.bottom, who.bottom, tune.bottom), space(1));
      AppearanceFixture.expectPixels(model.left, who.left);
      AppearanceFixture.expectPixels(host.bottom - model.bottom, space(2));
    });
  });
});
