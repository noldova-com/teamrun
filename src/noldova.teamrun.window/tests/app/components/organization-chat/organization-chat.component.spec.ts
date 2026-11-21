/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import { Conversation, ConversationListParams, Department, DepartmentMember, MessageSendParams, MessageSendResult, MethodName, Organization, OrganizationChat,
  OrganizationTarget, TeammateIdParams } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { OrganizationChatComponent } from "../../../../src/app/components/organization-chat/organization-chat.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { Resources } from "../../../../src/resources";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationChatComponent", () => {
  const organization = new Organization([new Department("d1", "Design", null, "alice", 0, "c", "u")],
    [new DepartmentMember("alice", "d1"), new DepartmentMember("bob", "d1")]);
  const chatOf = (teammateId: string): Conversation => new Conversation(`org-${teammateId}`, null, `Organization · ${teammateId}`, SampleData.timestamp, SampleData.timestamp,
    false, null, null, false, null, false, [], false, false, null, new OrganizationChat("my-organization", teammateId));
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationChatComponent>;
  let kept: readonly Conversation[];
  let opened: string[];
  let openAnswer: (teammateId: string) => JsonValue | Promise<JsonValue>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const sent = (): MessageSendParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessageSend))
    .map(t => MessageSendParams.fromJson(t.parameters));
  const create = async (target: OrganizationTarget): Promise<void> => {
    context = SampleData.createContext();
    new TeammateFixture(context);
    context.answer(MethodName.OrganizationList, () => organization.toJson())
      .answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? kept.map(u => u.toJson())
        : [SampleData.conversation.toJson()])
      .answer(MethodName.OrganizationChatOpen, t => {
        const id = TeammateIdParams.fromJson(t).teammateId;
        opened.push(id);
        return openAnswer(id);
      })
      .answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() },
      ChatStoreService.provider] });
    fixture = TestBed.createComponent(OrganizationChatComponent);
    fixture.componentRef.setInput("target", target);
    element().style.height = "40rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await Wait.until(() => expect(OrganizationStoreService.of(context).organization().departments).toHaveLength(1));
    await fixture.whenStable();
  };
  const texts = (selector: string): string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const type = async (text: string): Promise<void> => {
    const box = element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea");
    if (Object.isNull(box))
      throw new Error("No message box.");
    box.value = text;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await fixture.whenStable();
  };

  beforeEach(() => {
    globalThis.localStorage.removeItem(Resources.keptComposerDraftsStorageKey);
    kept = [];
    opened = [];
    openAnswer = id => chatOf(id).toJson();
  });

  afterEach(async () => {
    await fixture?.whenStable();
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("shows the teammate's own Organization chat with the chat's history and a composer answered by that teammate, opening none", async () => {
    kept = [chatOf("alice")];
    await create(OrganizationTarget.teammate("alice"));

    await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-history-message").length).toBeGreaterThan(0));
    await type("Ready?");
    await Wait.until(() => expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.disabled).toBe(false));
    element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.click();
    await Wait.until(() => expect(sent()).toHaveLength(1));

    expect([opened, sent()[0]?.chatId, sent()[0]?.responderTeammateId, sent()[0]?.text]).toEqual([[], "org-alice", "alice", "Ready?"]);
  });

  it("opens the teammate's Organization chat once when it has none, and the next teammate's when the choice moves", async () => {
    await create(OrganizationTarget.teammate("alice"));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-composer")).not.toBeNull());

    fixture.componentRef.setInput("target", OrganizationTarget.teammate("bob"));
    await Wait.until(() => expect(opened).toEqual(["alice", "bob"]));
    await fixture.whenStable();

    expect([element().querySelectorAll("nol-teamrun-composer").length, element().querySelector("[role=alert]")]).toEqual([1, null]);
  });

  it("says why the teammate's chat couldn't open, with no composer", async () => {
    openAnswer = () => Promise.reject(new Error("There is no teammate alice."));
    await create(OrganizationTarget.teammate("alice"));

    await Wait.until(() => expect(element().querySelector("[role=alert]")?.textContent?.trim()).toBe("There is no teammate alice."));
    expect([element().querySelector("nol-teamrun-composer"), element().querySelector("nol-teamrun-history"), opened]).toEqual([null, null, ["alice"]]);
  });

  it("sends one message to each recipient's own Organization chat, answered by that recipient, lists them with their reply status, and opens one's chat", async () => {
    kept = [chatOf("alice")];
    await create(OrganizationTarget.department("d1"));
    const changes: OrganizationTarget[] = [];
    fixture.componentInstance.target.subscribe(t => changes.push(t));

    expect([element().querySelector("nol-teamrun-history"), element().querySelector(".nol-teamrun-composer-picker")?.checkVisibility(),
      texts(".nol-teamrun-organization-recipient-name"), texts(".nol-teamrun-organization-recipient-status")])
      .toEqual([null, false, ["Alice", "Bob"], ["No reply yet", "No reply yet"]]);

    await type("Status?");
    await Wait.until(() => expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.disabled).toBe(false));
    element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.click();
    await Wait.until(() => expect(sent()).toHaveLength(2));

    expect([opened, sent().map(t => [t.chatId, t.responderTeammateId, t.text])]).toEqual([["bob"], [["org-alice", "alice", "Status?"], ["org-bob", "bob", "Status?"]]]);
    await Wait.until(() => expect(element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea")?.value).toBe(""));

    element().querySelectorAll<HTMLButtonElement>(".nol-teamrun-organization-recipient")[1]?.click();
    await fixture.whenStable();
    expect(changes.map(t => [t.kind, t.id])).toEqual([[OrganizationTarget.teammate("bob").kind, "bob"]]);
  });

  it("keeps a fan-out's unsent text for the same recipients across a new panel, and clears it once sent", async () => {
    await create(OrganizationTarget.department("d1"));
    await type("Draft for both");
    fixture.destroy();
    fixture = TestBed.createComponent(OrganizationChatComponent);
    fixture.componentRef.setInput("target", OrganizationTarget.department("d1"));
    fixture.autoDetectChanges();

    await Wait.until(() => expect(element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea")?.value).toBe("Draft for both"));
    element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.click();
    await Wait.until(() => expect(sent()).toHaveLength(2));
    await Wait.until(() => expect(globalThis.localStorage.getItem(Resources.keptComposerDraftsStorageKey)).toBe("{}"));
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const box = (selector: string): DOMRect => {
      const found = element().querySelector(selector);
      if (Object.isNull(found))
        throw new Error(`Nothing matches ${selector}.`);
      return found.getBoundingClientRect();
    };
    const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
    const rem = (): number => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const widen = async (width: number): Promise<DOMRect> => {
      element().style.width = `${width}rem`;
      await fixture.whenStable();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      return element().getBoundingClientRect();
    };

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it.each([20, 64])("heads a teammate's chat with its name, its history filling the %drem panel down to the composer at its foot", async width => {
      kept = [chatOf("alice")];
      await create(OrganizationTarget.teammate("alice"));
      await Wait.until(() => expect(element().querySelector(".history")).not.toBeNull());
      const host = await widen(width);
      const [head, title, history, composer] = [box(".nol-teamrun-organization-chat-head"), box(".nol-teamrun-organization-chat-title"), box(".history"),
        box("nol-teamrun-composer")];

      expect([element().querySelector(".nol-teamrun-organization-chat-icon"), texts(".nol-teamrun-organization-chat-title")]).toEqual([null, ["Chat with Alice"]]);
      AppearanceFixture.expectPixels(host.width, width * rem());
      AppearanceFixture.expectPixels(title.left, host.left + space(3));
      AppearanceFixture.expectPixels(title.right, host.right - space(3));
      AppearanceFixture.expectPixels(title.top, host.top + space(3));
      AppearanceFixture.expectPixels(head.bottom, title.bottom + space(3));
      for (const part of [history, composer]) {
        AppearanceFixture.expectPixels(part.left, host.left);
        AppearanceFixture.expectPixels(part.right, host.right);
      }
      AppearanceFixture.expectPixels(history.top, head.bottom);
      AppearanceFixture.expectPixels(history.bottom, composer.top);
      AppearanceFixture.expectPixels(composer.bottom, host.bottom);
    });

    it.each([20, 64])("heads a group with its icon and name over the composer, then each recipient's row with its status at the end, in the %drem panel", async width => {
      await create(OrganizationTarget.department("d1"));
      const host = await widen(width);
      const [head, icon, title, composer, list] = [box(".nol-teamrun-organization-chat-head"), box(".nol-teamrun-organization-chat-icon"),
        box(".nol-teamrun-organization-chat-title"), box("nol-teamrun-composer"), box(".nol-teamrun-organization-recipients")];
      const rows = [...element().querySelectorAll(".nol-teamrun-organization-recipient")].map(t => t.getBoundingClientRect());
      const names = [...element().querySelectorAll(".nol-teamrun-organization-recipient-name")].map(t => t.getBoundingClientRect());
      const states = [...element().querySelectorAll(".nol-teamrun-organization-recipient-status")].map(t => t.getBoundingClientRect());

      expect([texts(".nol-teamrun-organization-chat-title"), rows.length]).toEqual([["Chat with Design"], 2]);
      AppearanceFixture.expectPixels(icon.left, host.left + space(3));
      AppearanceFixture.expectPixels(icon.width, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(title.left, icon.right + space(2));
      AppearanceFixture.expectPixels(title.right, host.right - space(3));
      AppearanceFixture.expectPixels(icon.top + icon.height / 2, title.top + title.height / 2);
      AppearanceFixture.expectPixels(composer.top, head.bottom);
      AppearanceFixture.expectPixels(composer.left, host.left);
      AppearanceFixture.expectPixels(composer.right, host.right);
      AppearanceFixture.expectPixels(list.top, composer.bottom);
      AppearanceFixture.expectPixels(list.bottom, host.bottom);
      for (const [index, row] of rows.entries()) {
        AppearanceFixture.expectPixels(row.left, list.left + space(1));
        AppearanceFixture.expectPixels(row.right, list.right - space(1));
        AppearanceFixture.expectPixels(names[index]?.left ?? Number.NaN, row.left + space(2));
        AppearanceFixture.expectPixels(states[index]?.right ?? Number.NaN, row.right - space(2));
        expect((names[index]?.right ?? Number.POSITIVE_INFINITY) <= (states[index]?.left ?? 0) - space(2) + 1).toBe(true);
      }
    });
  });
});
