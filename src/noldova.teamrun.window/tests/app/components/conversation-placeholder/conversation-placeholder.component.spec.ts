/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { WindowPartTokens } from "@noldova/desktop.window";
import { ConversationCreateParams, FirstLaunch, MethodName, ProviderTool } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { ConversationPlaceholderComponent } from "../../../../src/app/components/conversation-placeholder/conversation-placeholder.component";
import { KeyHint } from "../../../../src/app/models/key-hint";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ConversationPlaceholderComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ConversationPlaceholderComponent>;
  let area: HTMLDivElement | null = null;
  const smallestWindowHeight = "calc(30rem - var(--nol-window-row-height) - var(--nol-status-bar-height))";

  const rem = (): number => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const host = (): HTMLElement => {
    const found: unknown = fixture.nativeElement;
    if (!(found instanceof HTMLElement))
      throw new Error("The placeholder has no element.");
    return found;
  };
  const one = <T extends Element>(type: abstract new () => T, selector: string, root: ParentNode = host()): T => {
    const found = root.querySelector(selector);
    if (!(found instanceof type))
      throw new Error(`Nothing shows ${selector}.`);
    return found;
  };
  const at = <T>(items: readonly T[], index: number): T => {
    const found = items[index];
    if (Object.isUndefined(found))
      throw new Error(`There is no item ${index}.`);
    return found;
  };
  const text = (): HTMLParagraphElement => one(HTMLParagraphElement, ".nol-teamrun-placeholder-text");
  const mark = (): HTMLSpanElement => one(HTMLSpanElement, ".nol-teamrun-placeholder-mark");
  const actions = (): HTMLDivElement => one(HTMLDivElement, ".nol-teamrun-placeholder-actions");
  const hintRow = (): HTMLDivElement => one(HTMLDivElement, ".nol-teamrun-placeholder-hints");
  const hints = (): HTMLSpanElement[] => [...host().querySelectorAll<HTMLSpanElement>(".nol-teamrun-placeholder-hint")];
  const buttons = (): HTMLButtonElement[] => [...host().querySelectorAll("button")];
  const labels = (): (string | undefined)[] => buttons().map(t => t.querySelector(".nol-button-label")?.textContent?.trim());
  const icons = (): (string | undefined)[] => buttons().map(t => t.querySelector("[nolButtonIcon]")?.textContent?.trim());
  const shownHints = (): string[][] => hints().map(t => [[...t.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent ?? "").join("").trim(),
    ...[...t.querySelectorAll("nol-chip")].map(chip => chip.textContent?.trim() ?? "")]);
  const centre = (box: DOMRect): number => (box.left + box.right) / 2;
  const rows = (boxes: readonly DOMRect[]): DOMRect[][] => boxes.reduce<DOMRect[][]>((found, box) => {
    const last = found.at(-1);
    if (Object.isUndefined(last) || box.top > at(last, 0).bottom - 0.5)
      found.push([box]);
    else
      last.push(box);
    return found;
  }, []);
  const rowCentre = (row: readonly DOMRect[]): number => (Math.min(...row.map(t => t.left)) + Math.max(...row.map(t => t.right))) / 2;
  const parts = (): HTMLElement[] => [mark(), text(), ...buttons(), ...hints()];
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const mount = (width: string, configure: (target: FakeWindowPartContext) => void, height: string = "30rem"): HTMLElement => {
    context = SampleData.createContext()
      .answer(MethodName.FirstLaunchRead, () => new FirstLaunch(SampleData.timestamp).toJson())
      .answer(MethodName.ProviderToolList, () => [new ProviderTool("codex", true, "0.98.0").toJson()]);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(ConversationPlaceholderComponent);
    area?.remove();
    area = document.createElement("div");
    Object.assign(area.style, { display: "flex", flexDirection: "column", minHeight: "0", overflow: "auto", width, height });
    document.body.append(area);
    area.append(host());
    fixture.autoDetectChanges();
    return host();
  };
  const create = async (width: string, configure: (target: FakeWindowPartContext) => void = () => undefined, height?: string): Promise<HTMLElement> => {
    const element = mount(width, configure, height);
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await settle();
    return element;
  };
  const noProviders = (target: FakeWindowPartContext): void => {
    target.answer(MethodName.ProviderList, () => []);
  };

  const shown = (): HTMLDivElement => {
    if (Object.isNull(area))
      throw new Error("The placeholder has no area.");
    return area;
  };

  afterEach(() => {
    fixture.destroy();
    area?.remove();
    area = null;
    ChatStoreService.release(context);
    AppearanceFixture.reset();
  });

  it.each([
    { mode: ThemeMode.Light, strength: 7 },
    { mode: ThemeMode.Dark, strength: 6 }
  ])("asks to choose or create a chat in heading text, under the TeamRun mark in the text colour at $strength%, in the $mode mode", async ({ mode, strength }) => {
    AppearanceFixture.apply(FixtureTheme.theme, mode);
    const element = await create("40rem");
    const probe = document.createElement("span");
    probe.style.color = "var(--nol-text)";
    probe.style.fontSize = "var(--nol-text-heading)";
    probe.style.lineHeight = "var(--nol-line-heading)";
    probe.style.backgroundColor = `color-mix(in srgb, var(--nol-text) ${strength}%, transparent)`;
    element.append(probe);
    const drawn = getComputedStyle(mark());

    expect(text().textContent?.trim()).toBe(Resources.noConversationText);
    expect([getComputedStyle(text()).color, getComputedStyle(text()).fontSize, getComputedStyle(text()).lineHeight])
      .toEqual([getComputedStyle(probe).color, getComputedStyle(probe).fontSize, getComputedStyle(probe).lineHeight]);
    expect([drawn.backgroundColor, drawn.maskImage.startsWith("url(\"data:image/png;base64,"), mark().getAttribute("aria-hidden")])
      .toEqual([getComputedStyle(probe).backgroundColor, true, "true"]);
  });

  it.each([ThemeMode.Light, ThemeMode.Dark])("centres the 11rem mark, the text, the buttons and the hints in the smallest window's area, 2rem, then 1.5rem apart, in the %s mode", async mode => {
    AppearanceFixture.apply(undefined, mode);
    await create("40rem", () => undefined, smallestWindowHeight);
    const bounds = shown().getBoundingClientRect();
    const drawn = mark().getBoundingClientRect();
    const line = text().getBoundingClientRect();
    const row = actions().getBoundingClientRect();
    const keys = hintRow().getBoundingClientRect();
    const boxes = buttons().map(t => t.getBoundingClientRect());
    const hintBoxes = hints().map(t => t.getBoundingClientRect());
    const near = (value: number, expected: number): boolean => Math.abs(value - expected) < 0.05;

    expect([drawn.width / rem(), drawn.height / rem()].map(t => near(t, 11))).toEqual([true, true]);
    expect([(line.top - drawn.bottom) / rem(), (row.top - line.bottom) / rem(), (keys.top - row.bottom) / rem()].map((t, index) => near(t, at([2, 1.5, 1.5], index))))
      .toEqual([true, true, true]);
    expect([centre(drawn), centre(line), rowCentre(boxes), rowCentre(hintBoxes)].map(t => Math.abs(t - centre(bounds)) <= 0.5)).toEqual([true, true, true, true]);
    expect(Math.abs((drawn.top - bounds.top) - (bounds.bottom - keys.bottom))).toBeLessThanOrEqual(0.5);
    expect([rows(boxes).length, rows(hintBoxes).length, at(boxes, 1).left - at(boxes, 0).right > 0, shown().scrollHeight <= shown().clientHeight])
      .toEqual([1, 1, true, true]);
  });

  it("shows a hint for New chat and Open a folder, and none for Search chats, which has no key, each key in the kit's key chip, in the platform's keys and muted text", async () => {
    AppearanceFixture.apply();
    await create("40rem");
    const isMac = navigator.platform.startsWith(Resources.macPlatformPrefix);
    const mod = isMac ? "⌘" : "Ctrl";
    const probe = document.createElement("span");
    probe.style.color = "var(--nol-text-muted)";
    host().append(probe);

    expect(shownHints()).toEqual([[Resources.newConversationLabel, mod, "N"], [Resources.openFolderLabel, mod, "O"]]);
    expect(shownHints()).toEqual([
      KeyHint.of(Resources.newConversationLabel, Resources.newConversationKey, isMac),
      KeyHint.of(Resources.openFolderLabel, Resources.openProjectKey, isMac)
    ].map(t => [t.label, ...t.keys]));
    expect([...host().querySelectorAll("nol-chip")].every(t => t.classList.contains("nol-chip-key"))).toBe(true);
    expect(hints().map(t => getComputedStyle(t).color)).toEqual(hints().map(() => getComputedStyle(probe).color));
  });

  it("opens the Providers tab with its welcome on a first launch with no provider, once, and no dialog", async () => {
    await create("40rem", t => {
      noProviders(t);
      t.answer(MethodName.FirstLaunchRead, () => new FirstLaunch(null).toJson());
    });

    await Wait.until(() => expect(context.openedDocuments.map(t => [t.name, t.instance, t.title])).toEqual([["teamrun.providers", "providers", "Providers"]]));
    expect([ChatStoreService.of(context).welcoming(), context.count(MethodName.FirstLaunchRead), context.count(MethodName.FirstLaunchFinish),
      document.querySelector(".nol-dialog-title")]).toEqual([true, 1, 0, null]);
  });

  it("reads the first launch again from Try again after its read failed, then opens the Providers tab with its welcome", async () => {
    await create("40rem", t => {
      noProviders(t);
      t.fail(MethodName.FirstLaunchRead, "offline");
    });
    await Wait.until(() => expect(context.shownNotices(Resources.loadFailedNotice).map(t => t.key)).toEqual([Resources.formatNoticeKey(ChatStoreService.of(context).windowId, Resources.firstLaunchLoad)]));
    expect([context.openedDocuments, ChatStoreService.of(context).welcoming()]).toEqual([[], false]);
    context.answer(MethodName.FirstLaunchRead, () => new FirstLaunch(null).toJson());

    await ChatStoreService.of(context).reload();

    await Wait.until(() => expect(context.openedDocuments.map(t => t.name)).toEqual(["teamrun.providers"]));
    expect([context.count(MethodName.FirstLaunchRead), context.shownNotices(Resources.loadFailedNotice), ChatStoreService.of(context).welcoming()]).toEqual([2, [], true]);
  });

  it("opens no Providers tab once the first launch was finished, or while a provider exists, and doesn't ask when there is one", async () => {
    await create("40rem", noProviders);
    expect([context.count(MethodName.FirstLaunchRead), context.openedDocuments, ChatStoreService.of(context).welcoming()]).toEqual([1, [], false]);
    ChatStoreService.release(context);
    TestBed.resetTestingModule();

    await create("40rem");
    expect([context.count(MethodName.FirstLaunchRead), context.openedDocuments, ChatStoreService.of(context).welcoming()]).toEqual([0, [], false]);
    expect(labels()).toEqual([Resources.newConversationLabel, Resources.openFolderLabel]);
  });

  it("shows no buttons until the store has loaded, so New chat never changes its look as Add a provider appears, and keeps the page still meanwhile", async () => {
    AppearanceFixture.apply();
    const providers = new DeferredResponse();
    mount("40rem", t => t.answer(MethodName.ProviderList, () => providers.promise));
    await settle();
    const before = [mark().getBoundingClientRect().top, hintRow().getBoundingClientRect().top];

    expect([ChatStoreService.of(context).loaded(), text().textContent?.trim(), buttons().length]).toEqual([false, Resources.noConversationText, 0]);
    providers.resolve([]);
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await settle();
    expect(labels()).toEqual([Resources.addAProviderLabel, Resources.newConversationLabel, Resources.openFolderLabel]);
    expect([mark().getBoundingClientRect().top, hintRow().getBoundingClientRect().top].map((t, index) => Math.abs(t - at(before, index)) <= 0.5)).toEqual([true, true]);
  });

  it.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("offers New chat and Open a folder with their commands' icons, side by side under the text and centred, in $look", async ({ mode, forcedColors }) => {
    AppearanceFixture.apply(FixtureTheme.theme, mode);
    await EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors);
    try {
      await create("40rem");
      const line = text().getBoundingClientRect();
      const newChat = at(buttons(), 0);
      const first = newChat.getBoundingClientRect();
      const second = at(buttons(), 1).getBoundingClientRect();

      expect([labels(), icons()]).toEqual([[Resources.newConversationLabel, Resources.openFolderLabel], [Resources.newConversationIcon, Resources.openProjectIcon]]);
      expect([first.top >= line.bottom, second.left >= first.right, Math.abs(second.top - first.top) <= 0.5, Math.abs(rowCentre([first, second]) - centre(line)) <= 0.5])
        .toEqual([true, true, true, true]);
      expect(first.width > 0 && first.height > 0 && getComputedStyle(newChat).visibility === "visible").toBe(true);
      newChat.focus();
      expect(document.activeElement).toBe(newChat);
    }
    finally {
      await EmulatedMediaFixture.resetAsync();
    }
  });

  it.each([
    { providers: "a provider", configure: (): void => undefined, shown: [Resources.newConversationLabel, Resources.openFolderLabel] },
    { providers: "no provider", configure: noProviders, shown: [Resources.addAProviderLabel, Resources.newConversationLabel, Resources.openFolderLabel] }
  ])("fits every part in the smallest document group's width, each row centred and nothing cut, and scrolls to the last hint, with $providers", async ({ configure, shown: expected }) => {
    AppearanceFixture.apply();
    await create("var(--nol-group-min-width)", configure, "var(--nol-group-min-height)");
    const scroller = shown();
    const bounds = scroller.getBoundingClientRect();

    expect(labels()).toEqual(expected);
    expect(parts().map(t => t.getBoundingClientRect()).map(t => t.width > 0 && t.left >= bounds.left - 0.5 && t.right <= bounds.right + 0.5))
      .toEqual(parts().map(() => true));
    expect([centre(mark().getBoundingClientRect()), centre(text().getBoundingClientRect()), ...rows(buttons().map(t => t.getBoundingClientRect())).map(rowCentre),
      ...rows(hints().map(t => t.getBoundingClientRect())).map(rowCentre)].every(t => Math.abs(t - centre(bounds)) <= 0.5)).toBe(true);
    expect(buttons().map(t => t.scrollWidth <= t.clientWidth)).toEqual(buttons().map(() => true));
    expect([scroller.scrollWidth <= scroller.clientWidth, mark().getBoundingClientRect().top >= bounds.top, scroller.scrollHeight > scroller.clientHeight])
      .toEqual([true, true, true]);
    scroller.scrollTop = scroller.scrollHeight;
    expect(at(hints(), hints().length - 1).getBoundingClientRect().bottom).toBeLessThanOrEqual(bounds.bottom + 0.5);
  });

  it("starts a chat in the selected project from New chat, as the Start chat command does", async () => {
    await create("40rem", t => t.answer(MethodName.ProjectList, () => [SampleData.listed(SampleData.project), SampleData.listed(SampleData.otherProject)]));
    await ChatStoreService.of(context).selectProject(SampleData.otherProject.id);

    one(HTMLButtonElement, ".nol-teamrun-placeholder-new-chat").click();

    await Wait.until(() => expect(context.count(MethodName.ConversationCreate)).toBe(1));
    expect(ConversationCreateParams.fromJson(context.parametersOf(MethodName.ConversationCreate)))
      .toEqual(new ConversationCreateParams(SampleData.otherProject.id, null, null));
  });

  it("offers Add a provider first, which opens the Providers tab, then New chat and Open a folder, with no provider, in one row centred under the text, and runs each",
    async () => {
    await create("40rem", t => {
      noProviders(t);
      t.answer(MethodName.ProjectList, () => []);
      t.answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
      t.chosenFolder = "D:\\other";
    });
    const add = one(HTMLButtonElement, ".nol-teamrun-placeholder-add-provider");
    const open = one(HTMLButtonElement, ".nol-teamrun-placeholder-open-folder");

    expect(labels()).toEqual([Resources.addAProviderLabel, Resources.newConversationLabel, Resources.openFolderLabel]);
    expect([rows(buttons().map(t => t.getBoundingClientRect())).length, Math.abs(rowCentre(buttons().map(t => t.getBoundingClientRect())) - centre(text().getBoundingClientRect())) <= 0.5,
      add.getBoundingClientRect().top >= text().getBoundingClientRect().bottom]).toEqual([1, true, true]);

    open.click();
    await Wait.until(() => expect(context.parametersOf(MethodName.ProjectOpen)).toEqual({ rootPath: "D:\\other" }));
    await settle();
    expect(host().querySelector(".nol-teamrun-placeholder-open-folder")).not.toBeNull();

    add.click();
    expect(context.openedDocuments.map(t => [t.name, t.instance, t.title])).toEqual([["teamrun.providers", "providers", "Providers"]]);
    expect(document.querySelector(".nol-dialog-title")).toBeNull();
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the empty chat's placeholder visible under forced colours", async () => {
      await create("40rem");
      expect(await AccessibilityFixture.expectVisibleForcedAsync(host())).toBeGreaterThan(0);
    });

    it("neither cuts, crosses nor loses a control in the empty chat's placeholder at 200% zoom", async () => {
      await create("40rem");
      await AccessibilityFixture.expectFitsZoomedAsync(host(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the empty chat's placeholder by keyboard, with a visible ring", async () => {
      await create("40rem");
      expect(await AccessibilityFixture.expectKeyboardAsync(host())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the empty chat's placeholder", async () => {
      await create("40rem");
      expect(AccessibilityFixture.expectNamed(host())).toBeGreaterThan(0);
    });
  });
});
