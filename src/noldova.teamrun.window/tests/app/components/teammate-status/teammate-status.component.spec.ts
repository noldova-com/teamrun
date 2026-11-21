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
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { TeammateStatusComponent } from "../../../../src/app/components/teammate-status/teammate-status.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("TeammateStatusComponent", () => {
  const started = "2026-09-10T08:00:00.000Z";
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<TeammateStatusComponent>;

  const reply = (id: string, status: MessageStatus): Message =>
    new Message(id, "c1", 1, MessageAuthor.Provider, null, status, [], SampleData.provenance, started, started, null, [], "alice", "alice");
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dot = (): HTMLElement => {
    const found = element().querySelector<HTMLElement>(".dot");
    if (Object.isNull(found))
      throw new Error("The status has no dot.");
    return found;
  };
  const label = (): string => element().querySelector(".label")?.textContent?.trim() ?? "";
  const colour = (token: string): string => {
    const probe = document.createElement("span");
    probe.style.color = `var(${token})`;
    element().append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  const shown = (): string[] => [label(), getComputedStyle(dot()).borderTopColor];
  const render = async (teammateId: string): Promise<void> => {
    context = SampleData.createContext();
    new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(TeammateStatusComponent);
    fixture.componentRef.setInput("teammateId", teammateId);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await fixture.whenStable();
  };

  afterEach(() => {
    TeammateStatusStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("says what a teammate is doing in a word after a dot of its colour, and follows each change", async () => {
    await render("alice");
    const idle = shown();
    context.emit(EventName.MessageCreated, reply("r1", MessageStatus.Running).toJson());
    await fixture.whenStable();
    const working = shown();
    context.emit(EventName.MessageUpdated, reply("r1", MessageStatus.AwaitingApproval).toJson());
    await fixture.whenStable();

    expect([idle, working, shown()]).toEqual([["Idle", colour("--nol-badge")], ["Working", colour("--nol-status-ok")],
      ["Waiting for you", colour("--nol-warning")]]);
    expect(dot().getAttribute("aria-hidden")).toBe("true");
  });

  it("marks a teammate whose provider can't serve as stopped", async () => {
    await render("offline");
    await Wait.until(() => expect(label()).toBe("Stopped"));

    expect(getComputedStyle(dot()).borderTopColor).toBe(colour("--nol-status-failed"));
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("draws a round dot half a rem across, centred on the word and a small space before it, and cuts a long word short", async () => {
      await render("alice");
      context.emit(EventName.MessageCreated, reply("r1", MessageStatus.AwaitingApproval).toJson());
      element().style.width = "4rem";
      await fixture.whenStable();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const text = element().querySelector<HTMLElement>(".label");
      if (Object.isNull(text))
        throw new Error("The status has no word.");
      const [box, word] = [dot().getBoundingClientRect(), text.getBoundingClientRect()];

      AppearanceFixture.expectPixels(box.width, 0.5 * rem);
      AppearanceFixture.expectPixels(box.height, 0.5 * rem);
      AppearanceFixture.expectPixels(box.left, element().getBoundingClientRect().left);
      AppearanceFixture.expectPixels(word.left - box.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(box.top + box.height / 2, word.top + word.height / 2);
      AppearanceFixture.expectPixels(word.right, element().getBoundingClientRect().right);
      expect([label(), getComputedStyle(dot()).borderRadius, getComputedStyle(text).textOverflow, text.scrollWidth > text.clientWidth])
        .toEqual(["Waiting for you", "50%", "ellipsis", true]);
    });
  });
});
