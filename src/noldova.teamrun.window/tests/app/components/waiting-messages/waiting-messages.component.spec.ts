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
import {
  AbilityCell,
  AttachmentInput,
  EventName,
  MessageDelivery,
  MessageSendParams,
  MessageStatus,
  MethodName,
  ProviderAbility,
  ProviderKind,
  WaitingMessage,
  WaitingMessageIdParams,
  WaitingMessagesPayload
} from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { WaitingMessagesComponent } from "../../../../src/app/components/waiting-messages/waiting-messages.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("WaitingMessagesComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<WaitingMessagesComponent>;
  const file = new AttachmentInput("notes.txt", "text/plain", "YQ==", null);
  const steerless = new ProviderKind("codex", "Codex", true, false, null, null, false, null, false, null, false, null,
    SampleData.abilities({ [ProviderAbility.SteerTurn]: AbilityCell.cannot("its agent reads a message only between replies") }));
  const present = <T>(value: T | null | undefined): T => {
    if (value === null || value === undefined)
      throw new Error("Not found.");
    return value;
  };
  const waiting = (id: string, text: string, delivery: MessageDelivery = MessageDelivery.Queue, attachments: readonly AttachmentInput[] = [],
    failure: string | null = null): WaitingMessage =>
    new WaitingMessage(id, delivery, new MessageSendParams("c1", text, SampleData.provenance.requested, "a1", attachments), SampleData.timestamp, failure);
  const render = async (chatId: string | null = "c1"): Promise<void> => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ChatStoreService.provider] });
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await store.selectConversation("c1");
    fixture = TestBed.createComponent(WaitingMessagesComponent);
    fixture.componentRef.setInput("chatId", chatId);
    await fixture.whenStable();
  };
  const listed = async (chatId: string, ...messages: readonly WaitingMessage[]): Promise<void> => {
    context.emit(EventName.WaitingMessagesChanged, new WaitingMessagesPayload(chatId, messages).toJson());
    await fixture.whenStable();
  };
  const root = (): HTMLElement => fixture.debugElement.nativeElement;
  const section = (): HTMLElement | null => root().querySelector<HTMLElement>(".nol-teamrun-waiting");
  const rows = (): HTMLElement[] => [...root().querySelectorAll<HTMLElement>(".nol-teamrun-waiting-row")];
  const partsOf = (selector: string): (string | undefined)[] => rows().map(t => t.querySelector(selector)?.textContent?.trim());
  const click = async (element: HTMLElement): Promise<void> => {
    element.click();
    await fixture.whenStable();
  };
  const menuOf = (row: number): Promise<void> => click(present(rows()[row]?.querySelector<HTMLButtonElement>(".nol-teamrun-waiting-menu")));
  const action = (name: string): HTMLButtonElement => present(document.querySelector<HTMLButtonElement>(`button.nol-teamrun-waiting-${name}`));

  beforeEach(() => {
    context = SampleData.createContext();
  });

  afterEach(() => ChatStoreService.release(context));

  it("shows nothing until a message waits, then a titled list of each one's way, first line and files, for its own chat only", async () => {
    await render();
    expect(section()).toBeNull();

    await listed("c1", waiting("w1", "\n  look again  \nand the docs"), waiting("w2", "", MessageDelivery.Steer, [file, file]));
    expect([section()?.getAttribute("aria-label"), section()?.querySelector("h2")?.textContent?.trim()]).toEqual([Resources.waitingMessagesLabel, "Waiting (2)"]);
    expect(partsOf("nol-chip")).toEqual(["Queue", "Steer"]);
    expect(partsOf(".nol-teamrun-waiting-text")).toEqual(["look again", "2 files"]);
    expect(partsOf(".nol-teamrun-waiting-files")).toEqual([undefined, "2 files"]);
    expect(rows().map(t => t.querySelector(".nol-teamrun-waiting-menu")?.getAttribute("aria-label")))
      .toEqual([Resources.formatWaitingMenu("look again"), Resources.formatWaitingMenu("2 files")]);
    expect(partsOf(".nol-teamrun-waiting-note")).toEqual([undefined, undefined]);

    await listed("c2", new WaitingMessage("w9", MessageDelivery.Queue, new MessageSendParams("c2", "elsewhere", SampleData.provenance.requested, "a1"),
      SampleData.timestamp));
    expect(rows()).toHaveLength(2);
    fixture.componentRef.setInput("chatId", null);
    await fixture.whenStable();
    expect(section()).toBeNull();
  });

  it("says why a Steer message waits while the reply's provider can't steer, until the reply ends, and shows a failed message's failure", async () => {
    context.answer(MethodName.ProviderKindList, () => [steerless.toJson(), SampleData.claude.toJson()]);
    await render();
    await listed("c1", waiting("w1", "look again", MessageDelivery.Steer), waiting("w2", "then the docs"),
      waiting("w3", "wrong file", MessageDelivery.StopAndSend, [], "The provider is gone."));

    expect(partsOf(".nol-teamrun-waiting-note")).toEqual([
      "Waits for the reply to end. Codex can't read a message during its reply: its agent reads a message only between replies.", undefined, "The provider is gone."]);
    expect(rows().map(t => t.querySelector("nol-chip")?.classList.contains("nol-chip-failed"))).toEqual([false, false, true]);
    expect(rows().map(t => t.querySelector("nol-chip")?.classList.contains("nol-chip-status"))).toEqual([true, true, true]);

    context.emit(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson());
    await Wait.until(() => expect(partsOf(".nol-teamrun-waiting-note")).toEqual([undefined, undefined, "The provider is gone."]));
  });

  it("offers Edit, Send now and then Remove past a divider, sends or removes the one asked, and offers Edit only while it may", async () => {
    context.answer(MethodName.WaitingMessageSendNow, () => null).answer(MethodName.WaitingMessageRemove, () => null);
    await render();
    await listed("c1", waiting("w1", "look again"), waiting("w2", "then the docs"));
    const edits: string[] = [];
    fixture.componentInstance.edit.subscribe(t => edits.push(t.id));
    const idOf = (method: MethodName): string => WaitingMessageIdParams.fromJson(context.parametersOf(method)).id;

    await menuOf(0);
    const menu = present([...document.querySelectorAll("nol-menu")].at(-1));
    expect([...menu.querySelectorAll("button[nol-menu-item], nol-menu-separator")].map(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() ?? t.localName))
      .toEqual([Resources.editWaitingLabel, Resources.sendWaitingNowLabel, "nol-menu-separator", Resources.removeWaitingLabel]);
    expect(menu.getAttribute("aria-label")).toBe(Resources.formatWaitingMenu("look again"));
    await click(action("send-now"));
    expect(idOf(MethodName.WaitingMessageSendNow)).toBe("w1");

    await menuOf(1);
    await click(action("remove"));
    expect(idOf(MethodName.WaitingMessageRemove)).toBe("w2");

    await menuOf(1);
    await click(action("edit"));
    expect(edits).toEqual(["w2"]);
    fixture.componentRef.setInput("editable", false);
    await fixture.whenStable();
    await menuOf(0);
    expect(action("edit").getAttribute("aria-disabled")).toBe("true");
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const box = (target: Element | null | undefined): DOMRect => present(target).getBoundingClientRect();
    const middle = (rect: DOMRect): number => rect.top + rect.height / 2;

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it.each([20, 70])("keeps each row on one line within the composer's width at %srem, its text cut off, its menu at the end and its note under its text", async width => {
      await render();
      root().style.width = `${AppearanceFixture.toPixels(width)}px`;
      await listed("c1", waiting("w1", "look again ".repeat(40), MessageDelivery.Steer, [file], "The provider is gone."));
      const row = present(rows()[0]);
      const [chip, text, files, menu, note] = ["nol-chip", ".nol-teamrun-waiting-text", ".nol-teamrun-waiting-files", ".nol-teamrun-waiting-menu", ".nol-teamrun-waiting-note"]
        .map(t => box(row.querySelector(t)));
      const list = box(section());

      AppearanceFixture.expectPixels(list.width, Math.min(AppearanceFixture.toPixels(width), AppearanceFixture.toPixels(55)));
      AppearanceFixture.expectPixels(list.left - box(root()).left, (box(root()).width - list.width) / 2);
      AppearanceFixture.expectPixels(present(chip).left, list.left + space(3));
      AppearanceFixture.expectPixels(present(menu).right, list.right - space(3));
      AppearanceFixture.expectPixels(present(text).left, present(chip).right + space(2));
      AppearanceFixture.expectPixels(present(files).left, present(text).right + space(2));
      AppearanceFixture.expectPixels(present(menu).left, present(files).right + space(2));
      for (const part of [chip, text, files])
        expect(Math.abs(middle(present(part)) - middle(present(menu)))).toBeLessThan(1);
      AppearanceFixture.expectTruncates(present(row.querySelector<HTMLElement>(".nol-teamrun-waiting-text")));
      AppearanceFixture.expectPixels(present(note).left, present(text).left);
      expect(present(note).top).toBeGreaterThanOrEqual(present(menu).bottom - 0.5);
      expect(present(note).right).toBeLessThanOrEqual(present(menu).right + 0.5);
    });
  });
});
