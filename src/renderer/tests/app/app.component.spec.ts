/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { Conversation, ErrorCode, MethodName } from "@noldova/teamrun-protocol";

import type { FakeTeamRunBridge } from "../fixtures/fake-teamrun-bridge";
import { MemoryStorage } from "../fixtures/memory-storage";
import { SampleData } from "../fixtures/sample-data";
import { AppComponent } from "../../src/app/app.component";
import { DockSide } from "../../src/app/enums/dock-side";
import { PanelId } from "../../src/app/enums/panel-id";
import { Resources } from "../../src/app/resources";
import { ImageSource } from "../../src/app/models/image-source";
import { NavigationService } from "../../src/app/services/navigation.service";
import { LayoutService } from "../../src/app/services/layout.service";
import { TEAMRUN_BRIDGE } from "../../src/app/services/bridge.service";
import { ChatStore } from "../../src/app/services/chat-store.service";

describe("AppComponent", () => {
  const start = async (bridge: FakeTeamRunBridge, ready: (store: ChatStore) => boolean): Promise<ComponentFixture<AppComponent>> => {
    TestBed.configureTestingModule({ imports: [AppComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    TestBed.inject(LayoutService).showDocument("c1");
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(ready(store)).toBe(true));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it("attaches files dropped over messages or the composer, and clears the target when switching views", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => [SampleData.userMessage.toJson()]);
    const fixture = await start(bridge, store => store.selectedConversationId() !== null && !store.isBusy());
    const root = fixture.nativeElement as HTMLElement;
    const region = root.querySelector(".tr-chat-view")!;
    for (const selector of ["tr-message-list", "tr-composer textarea"]) {
      const target = root.querySelector(selector)!;
      const enter = new Event("dragenter", { bubbles: true, cancelable: true });
      Object.defineProperty(enter, "dataTransfer", { value: { types: ["Files"] } });
      target.dispatchEvent(enter);
      await fixture.whenStable();
      expect(region.querySelector(".tr-file-drop-overlay")?.textContent).toContain("Drop to attach");
      const drop = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(drop, "dataTransfer", { value: { files: [new File(["note"], "notes.txt")] } });
      target.dispatchEvent(drop);
      await fixture.whenStable();
      expect(drop.defaultPrevented).toBe(true);
      expect(region.querySelector(".tr-file-drop-overlay")).toBeNull();
    }
    expect(root.querySelectorAll("tr-composer .tr-attachment")).toHaveLength(2);
    const enter = new Event("dragenter", { bubbles: true, cancelable: true });
    Object.defineProperty(enter, "dataTransfer", { value: { types: ["Files"] } });
    region.dispatchEvent(enter);
    await fixture.whenStable();
    TestBed.inject(NavigationService).openSettings();
    await fixture.whenStable();
    expect(region.querySelector(".tr-file-drop-overlay")).toBeNull();
    TestBed.inject(NavigationService).closeSettings();
    await fixture.whenStable();
    expect(root.querySelectorAll("tr-composer .tr-attachment")).toHaveLength(2);
    expect(region.querySelector(".tr-file-drop-overlay")).toBeNull();
    fixture.destroy();
  });

  it("renders the shell, loads the catalog, and restores a saved conversation", async () => {
    const bridge = SampleData.createBridge();
    const fixture = await start(bridge, store => store.selectedConversationId() !== null && !store.isBusy());
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";

    expect((fixture.nativeElement as HTMLElement).querySelector("tr-brand-mark")).toBeNull();
    expect(text).toContain(SampleData.project.name);
    expect(text).toContain(SampleData.conversation.title);
    expect(text).toContain("hello");
    expect(text).toContain(Resources.approvalTitle);
    expect(bridge.methods).toContain(MethodName.MessagePage);
    expect(bridge.methods).not.toContain(MethodName.MessageList);
    fixture.destroy();
    expect(bridge.listenerCount).toBe(0);
  });

  it("starts with no conversation when no tabs were saved", async () => {
    MemoryStorage.install(window);
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ imports: [AppComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(store.loaded() && !store.isBusy()).toBe(true));
    await fixture.whenStable();
    expect(store.loaded()).toBe(true);
    expect(store.selectedProjectId()).toBe("p1");
    expect(store.selectedConversationId()).toBeNull();
    expect(TestBed.inject(LayoutService).documents()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector("tr-message-card")).toBeNull();
    expect(bridge.methods).not.toContain(MethodName.MessagePage);
    fixture.destroy();
  });

  it("keeps the draft and composer mounted while viewing images or Settings", async () => {
    MemoryStorage.install(window);
    const fixture = await start(SampleData.createBridge().answer(MethodName.MessageList, () => []).answer(MethodName.ApprovalList, () => []), store => store.selectedConversationId() !== null && !store.isBusy());
    const root = fixture.nativeElement as HTMLElement;
    const textarea = root.querySelector<HTMLTextAreaElement>('tr-composer textarea')!;
    textarea.value = 'Keep this draft';
    textarea.dispatchEvent(new Event('input'));
    const navigation = TestBed.inject(NavigationService);
    navigation.openImage(new ImageSource('1', 'missing.png', 'D:/missing.png', null));
    fixture.detectChanges();
    expect(root.querySelector('tr-composer textarea')).toBe(textarea);
    expect(root.querySelector<HTMLElement>('.tr-chat-view')?.style.visibility).toBe('hidden');
    navigation.openSettings();
    fixture.detectChanges();
    navigation.closeSettings();
    fixture.detectChanges();
    expect(root.querySelector('tr-composer textarea')).toBe(textarea);
    expect(textarea.value).toBe('Keep this draft');
    expect(root.querySelector<HTMLElement>('.tr-chat-view')?.style.visibility).toBe('');
    fixture.destroy();
  });

  it("lays the docks out around the document area and hides the left one from the toggle", async () => {
    MemoryStorage.install(window);
    Object.defineProperty(window, "innerWidth", { value: 1920, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 1080, configurable: true });
    const fixture = await start(SampleData.createBridge(), store => store.selectedConversationId() !== null && !store.isBusy());
    const element = fixture.nativeElement as HTMLElement;
    const docks = (): string[] => Array.from(element.querySelectorAll("tr-dock")).map(t => `${t.getAttribute("data-side")}:${t.classList.contains("hidden")}`);
    const columns = (): string => element.querySelector<HTMLElement>("tr-dock[data-side='Left']")!.parentElement!.style.gridTemplateColumns;

    expect(docks()).toEqual(["Left:false", "Bottom:false", "Right:false"]);
    expect(element.querySelector("tr-dock[data-side='Left'] tr-sidebar")).not.toBeNull();
    expect(element.querySelectorAll("tr-document-tabs .tr-tab")).toHaveLength(1);
    expect(element.querySelector("tr-dock[data-side='Bottom'] .tr-dock-strip")).not.toBeNull();
    const gap = Resources.shellGap;
    expect(columns()).toBe(`${Resources.defaultDockSizes.Left + gap}px minmax(0, 1fr) ${Resources.defaultDockSizes.Right + gap}px`);
    expect(element.querySelector<HTMLButtonElement>(".tr-history-back")!.disabled).toBe(true);
    expect(element.querySelector(".tr-search-open")).not.toBeNull();
    element.querySelector<HTMLButtonElement>(".tr-settings-open")!.click();
    fixture.detectChanges();
    expect(element.querySelector("main tr-settings-page")).not.toBeNull();
    expect(element.querySelector(".tr-settings-tab")).not.toBeNull();
    element.querySelector<HTMLElement>(".tr-settings-tab .tr-tab-close")!.click();
    fixture.detectChanges();
    expect(element.querySelector("tr-settings-page")).toBeNull();

    element.querySelector<HTMLButtonElement>(".tr-panel-toggle")!.click();
    fixture.detectChanges();
    expect(element.querySelector("tr-dock[data-side='Left'] .tr-dock-strip")).not.toBeNull();
    expect(columns()).toBe(`${Resources.dockStripSize + Resources.shellGap}px minmax(0, 1fr) ${Resources.defaultDockSizes.Right + Resources.shellGap}px`);

    TestBed.inject(LayoutService).closePanel(PanelId.Changes);
    fixture.detectChanges();
    expect(docks()).toEqual(["Left:false", "Bottom:false", "Right:true"]);
    expect(columns()).toBe(`${Resources.dockStripSize + Resources.shellGap}px minmax(0, 1fr) 0`);
    expect(element.querySelector("tr-dock[data-side='Right']")?.classList.contains("col-start-3")).toBe(true);
    expect(element.querySelector("tr-dock[data-side='Bottom']")?.classList.contains("row-start-2")).toBe(true);

    element.querySelector<HTMLButtonElement>(".tr-panels-menu")!.click();
    fixture.detectChanges();
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>(".mat-mdc-menu-panel button"));
    expect(items.map(t => t.textContent?.includes(Resources.panelLabels[PanelId.Changes]))).toContain(true);
    items.find(t => t.textContent?.includes(Resources.panelLabels[PanelId.Changes]))!.click();
    fixture.detectChanges();
    expect(TestBed.inject(LayoutService).isOpen(PanelId.Changes)).toBe(true);
    element.querySelector<HTMLButtonElement>(".tr-panels-menu")!.click();
    fixture.detectChanges();
    document.querySelector<HTMLButtonElement>(".mat-mdc-menu-panel .tr-reset-layout")!.click();
    fixture.detectChanges();
    expect(TestBed.inject(LayoutService).dock(DockSide.Left).collapsed).toBe(false);
    TestBed.inject(LayoutService).closePanel(PanelId.Changes);
    TestBed.inject(LayoutService).toggleDock(DockSide.Left);
    fixture.detectChanges();

    expect(element.querySelectorAll(".tr-dock-guide")).toHaveLength(0);
    const tab = element.querySelector<HTMLElement>("tr-dock[data-side='Left'] .tr-dock-strip-button")!;
    tab.click();
    fixture.detectChanges();
    let under: Element | null = null;
    document.elementFromPoint = (): Element | null => under;
    element.querySelector<HTMLElement>("tr-dock[data-side='Left'] .tr-tab")!
      .dispatchEvent(new PointerEvent("pointerdown", { clientX: 10, clientY: 10, button: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 200, clientY: 200, bubbles: true }));
    fixture.detectChanges();
    expect(Array.from(element.querySelectorAll<HTMLElement>(".tr-dock-guide-edge")).map(t => t.dataset["guide"])).toEqual(["Left", "Right", "Bottom"]);
    expect(Array.from(element.querySelectorAll<HTMLElement>(".tr-dock-compass .tr-dock-guide-arm")).map(t => t.dataset["arm"]))
      .toEqual(["Left", "Right", "Bottom"]);
    expect(element.querySelector(".tr-drop-preview")).toBeNull();
    expect(element.querySelector(".tr-drag-ghost")?.textContent).toContain(Resources.panelLabels[PanelId.Explorer]);
    expect(element.querySelector<HTMLElement>(".tr-drag-ghost")?.style.left).toBe(`${200 + Resources.ghostOffset}px`);
    const guide = element.querySelector<HTMLElement>(".tr-dock-guide-edge[data-guide='Right']")!;
    under = guide;
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 900, clientY: 300, bubbles: true }));
    fixture.detectChanges();
    expect(guide.classList.contains("tr-dock-guide-active")).toBe(true);
    expect(element.querySelector<HTMLElement>(".tr-dock-guide-arm[data-arm='Right']")?.classList.contains("tr-dock-guide-active")).toBe(true);
    const preview = element.querySelector<HTMLElement>(".tr-drop-preview")!;
    expect(preview.dataset["preview"]).toBe("Right");
    expect(preview.style.width).toBe(`${Resources.defaultDockSizes.Right}px`);
    expect(preview.style.right).toBe("0px");
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 900, clientY: 300, bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelectorAll(".tr-dock-guide")).toHaveLength(0);
    expect(TestBed.inject(LayoutService).dock(DockSide.Right).panels).toEqual([PanelId.Explorer]);
    fixture.destroy();
  });

  it("shows the busy bar only once the work has lasted a moment", async () => {
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    const fixture = await start(bridge, store => store.selectedConversationId() !== null && !store.isBusy());
    const store = TestBed.inject(ChatStore);
    const element = fixture.nativeElement as HTMLElement;
    const bar = (): Element | null => element.querySelector("mat-progress-bar");
    const original = bridge.invoke.bind(bridge);
    const settle = async (): Promise<void> => { for (let i = 0; i < 20 && store.isBusy(); i++) await vi.advanceTimersByTimeAsync(1000); fixture.detectChanges(); };
    expect(bar()).toBeNull();
    vi.useFakeTimers();
    try {
      const held = vi.spyOn(bridge, "invoke").mockImplementation(async request => {
        const result = await original(request);
        await new Promise<void>(resolve => setTimeout(resolve, 1000));
        return result;
      });
      const slow = store.selectConversation("c2");
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(store.isBusy()).toBe(true);
      expect(bar()).toBeNull();
      await vi.advanceTimersByTimeAsync(Resources.busyBarDelay - 1);
      fixture.detectChanges();
      expect(bar()).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();
      expect(bar()).not.toBeNull();
      await settle();
      await slow;
      expect(store.isBusy()).toBe(false);
      expect(bar()).toBeNull();

      held.mockImplementation(async request => {
        const result = await original(request);
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        return result;
      });
      const quick = store.selectConversation("c1");
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(store.isBusy()).toBe(true);
      await settle();
      await quick;
      expect(bar()).toBeNull();
      await vi.advanceTimersByTimeAsync(Resources.busyBarDelay);
      fixture.detectChanges();
      expect(bar()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a runtime failure with a dismiss action", async () => {
    const bridge = SampleData.createBridge().fail(MethodName.ProjectList, ErrorCode.Unavailable, "runtime down");
    const fixture = await start(bridge, store => store.error() !== null);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector("[role=alert]")?.textContent).toContain("runtime down");
    element.querySelector<HTMLButtonElement>("[role=alert] button")?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector("[role=alert]")).toBeNull();
    fixture.destroy();
  });
});
