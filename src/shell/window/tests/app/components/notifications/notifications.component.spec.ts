/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type WritableSignal, computed, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  type CommandRun, Notification, NotificationAction, NotificationPost, NotificationSeverity, NotificationState, CommandRun as Run, QualifiedName
} from "@noldova/teamrun-shell-protocol";

import { NotificationsComponent } from "../../../../src/app/components/notifications/notifications.component";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { NotificationService } from "../../../../src/app/services/notification.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

class FakeNotificationService {
  public readonly calls: string[] = [];
  public readonly stateValue: WritableSignal<NotificationState> = signal(new NotificationState([], false, 0));
  public readonly state = this.stateValue.asReadonly();
  public readonly unreadCount = computed(() => this.stateValue().notifications.filter(t => !t.isRead).length);
  public failure: Error | null = null;

  public isAvailable(command: CommandRun): boolean {
    return command.name.text !== "clock.reset";
  }

  public runAsync(command: CommandRun): Promise<JsonValue> {
    this.calls.push(`run ${command.name.text}`);
    return this.failure === null ? Promise.resolve(null) : Promise.reject(this.failure);
  }

  public markAllRead(): void {
    this.calls.push("read");
  }

  public clear(): void {
    this.calls.push("clear");
  }

  public dismiss(id: number): void {
    this.calls.push(`dismiss ${id}`);
  }

  public setDoNotDisturb(isOn: boolean): void {
    this.calls.push(`quiet ${String(isOn)}`);
  }
}


async function expectTooltipAsync(button: HTMLElement | null | undefined, text: string): Promise<void> {
  const tooltip = (): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>(".cdk-overlay-container tr-tooltip")].find(t => t.textContent?.trim() === text);
  button?.dispatchEvent(new PointerEvent("pointerenter"));
  await vi.waitFor(() => expect(tooltip()).toBeDefined());
  button?.dispatchEvent(new PointerEvent("pointerleave"));
  await vi.waitFor(() => expect(tooltip()).toBeUndefined());
  expect(button?.hasAttribute("title")).toBe(false);
}

describe("NotificationsComponent", () => {
  const run = (name: string): CommandRun => new Run(QualifiedName.parse(name), null);
  const notification = (
    id: number,
    kind: string,
    title: string,
    options: Partial<{ text: string; severity: NotificationSeverity; open: string; actions: readonly string[]; progress: number | typeof NotificationPost.indeterminate; isRead: boolean }> = {}): Notification =>
    new Notification(id, id, new NotificationPost(
      QualifiedName.parse(kind), null, title, options.text ?? null, options.severity ?? NotificationSeverity.Info,
      options.open === undefined ? null : run(options.open), (options.actions ?? []).map(t => new NotificationAction(`Run ${t}`, run(t))),
      options.progress ?? null), "2026-10-03T08:05:00.000Z", options.isRead ?? false);
  let service: FakeNotificationService;
  let errors: unknown[];

  beforeEach(() => {
    service = new FakeNotificationService();
    errors = [];
    DesktopBridgeFixture.install();
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationService, useValue: service },
        { provide: WindowPartTokens.sources, useValue: [new WindowPartSource("notes", "Notes", [], [], [], [], [], [], [], () => Promise.reject(new Error("unused")))] },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
  });

  afterEach(() => DesktopBridgeFixture.remove());

  async function renderAsync(): Promise<ComponentFixture<NotificationsComponent>> {
    const fixture = TestBed.createComponent(NotificationsComponent);
    await fixture.whenStable();
    return fixture;
  }

  function item(fixture: ComponentFixture<NotificationsComponent>): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector("button.tr-notifications-item") as HTMLButtonElement;
  }

  function popover(): HTMLElement | null {
    return document.querySelector(".tr-notifications-popover");
  }

  async function openAsync(fixture: ComponentFixture<NotificationsComponent>): Promise<HTMLElement> {
    item(fixture).click();
    await fixture.whenStable();
    return popover() as HTMLElement;
  }

  it("shows a bell with its unread count, capped at 9+, and a silenced bell while Do not disturb is on", async () => {
    const fixture = await renderAsync();
    const quietLabel = (): string | null => item(fixture).getAttribute("aria-label");
    const empty = [item(fixture).textContent?.trim(), quietLabel()];

    service.stateValue.set(new NotificationState(Array.from({ length: 12 }, (_, index) => notification(index + 1, "clock.alarm", `Alarm ${index}`)), true, 0));
    await fixture.whenStable();

    expect(empty).toEqual(["notifications", "Notifications"]);
    expect([item(fixture).querySelector(".tr-notifications-icon")?.textContent, item(fixture).querySelector(".tr-notifications-count")?.textContent]).toEqual(["notifications_off", "9+"]);
    expect(quietLabel()).toBe("Notifications, 12 unread, Do not disturb");
    await expectTooltipAsync(item(fixture), "Notifications, 12 unread, Do not disturb");
  });

  it("opens its list, marking everything read only when something is unread, and closes on a second click, Escape and a click outside", async () => {
    service.stateValue.set(new NotificationState([notification(1, "clock.alarm", "Alarm")], false, 0));
    const fixture = await renderAsync();

    const opened = await openAsync(fixture);
    const expanded = item(fixture).getAttribute("aria-expanded");
    item(fixture).click();
    await fixture.whenStable();
    const afterSecondClick = popover();
    service.stateValue.set(new NotificationState([notification(1, "clock.alarm", "Alarm", { isRead: true })], false, 0));
    await openAsync(fixture);
    await userEvent.keyboard("{Escape}");
    await fixture.whenStable();
    const focusAfterEscape = document.activeElement;
    await openAsync(fixture);
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await fixture.whenStable();

    expect(opened.getAttribute("aria-label")).toBe("Notifications");
    expect(expanded).toBe("true");
    expect(afterSecondClick).toBeNull();
    expect(focusAfterEscape).toBe(item(fixture));
    expect(popover()).toBeNull();
    expect(service.calls).toEqual(["read"]);
  });

  it("stays open for other keys and closes when something around the item scrolls", async () => {
    const fixture = await renderAsync();

    await openAsync(fixture);
    await userEvent.keyboard("{ArrowDown}");
    await fixture.whenStable();
    const isOpenAfterKey = popover() !== null;
    (fixture.nativeElement as HTMLElement).style.marginTop = "40px";
    (fixture.nativeElement as HTMLElement).dispatchEvent(new Event("scroll"));
    await fixture.whenStable();

    expect(isOpenAfterKey).toBe(true);
    expect(popover()).toBeNull();
  });

  it("lists each notification with its severity, title, text, module, time, progress and actions, and says when there are none", async () => {
    const fixture = await renderAsync();
    const empty = (await openAsync(fixture)).querySelector(".tr-notifications-empty")?.textContent;
    service.stateValue.set(new NotificationState([
      notification(3, "notes.saved", "Saved", { severity: NotificationSeverity.Success, text: "Plan.md", open: "notes.open", actions: ["notes.undo", "clock.reset"], isRead: true }),
      notification(2, "clock.sync", "Syncing", { severity: NotificationSeverity.Warning, progress: NotificationPost.indeterminate, isRead: true }),
      notification(1, "clock.sync", "Copying", { severity: NotificationSeverity.Error, progress: 0.25, isRead: true })
    ], false, 0));
    await fixture.whenStable();
    const rows = [...(popover() as HTMLElement).querySelectorAll<HTMLElement>(".tr-notifications-row")];

    expect(empty).toBe("No notifications");
    expect(rows.map(t => [t.dataset["notification"], t.querySelector(".tr-notifications-severity")?.getAttribute("aria-label"), t.querySelector(".tr-notifications-row-title")?.textContent?.trim()]))
      .toEqual([["3", "Success", "Saved"], ["2", "Warning", "Syncing"], ["1", "Error", "Copying"]]);
    expect(rows[0]?.querySelector(".tr-notifications-text")?.textContent).toBe("Plan.md");
    expect(rows[0]?.querySelector(".tr-notifications-meta")?.textContent).toMatch(/^Notes · \d{1,2}:05/);
    expect(rows[1]?.querySelector(".tr-notifications-meta")?.textContent).toMatch(/^clock · /);
    expect(rows[1]?.querySelector("progress")?.hasAttribute("value")).toBe(false);
    expect(rows[2]?.querySelector("progress")?.getAttribute("value")).toBe("0.25");
    expect([...rows[0]?.querySelectorAll<HTMLButtonElement>(".tr-notifications-action") ?? []].map(t => [t.textContent?.trim(), t.disabled]))
      .toEqual([["Run notes.undo", false], ["Run clock.reset", true]]);
    expect(rows[0]?.querySelector<HTMLButtonElement>("button.tr-notifications-open")?.disabled).toBe(false);
    expect(rows[1]?.querySelector("button.tr-notifications-open")).toBeNull();
  });

  it("runs an action or the open command and closes, dismisses one, clears all and switches Do not disturb", async () => {
    service.stateValue.set(new NotificationState([
      notification(2, "notes.saved", "Saved", { open: "notes.open", actions: ["notes.undo"], isRead: true }),
      notification(1, "clock.sync", "Syncing", { progress: 0.5, isRead: true })
    ], false, 0));
    const fixture = await renderAsync();

    (await openAsync(fixture)).querySelector<HTMLButtonElement>(".tr-notifications-action")?.click();
    await fixture.whenStable();
    const closedAfterAction = popover();
    (await openAsync(fixture)).querySelector<HTMLButtonElement>("button.tr-notifications-open")?.click();
    await fixture.whenStable();
    const list = await openAsync(fixture);
    await expectTooltipAsync(list.querySelector<HTMLButtonElement>(".tr-notifications-dismiss"), "Dismiss");
    list.querySelector<HTMLButtonElement>(".tr-notifications-dismiss")?.click();
    list.querySelector<HTMLButtonElement>(".tr-notifications-clear")?.click();
    list.querySelector<HTMLInputElement>(".tr-notifications-quiet-box")?.click();

    expect(closedAfterAction).toBeNull();
    expect(service.calls).toEqual(["run notes.undo", "run notes.open", "dismiss 2", "clear", "quiet true"]);
  });

  for (const theme of AppearanceFixture.themes)
    it(`draws its Do not disturb checkbox at the ${theme.id} theme's size and shows its mark only while checked`, async () => {
      AppearanceFixture.apply(theme);
      service.stateValue.set(new NotificationState([], false, 0));
      const fixture = await renderAsync();

      const list = await openAsync(fixture);
      const box = list.querySelector(".tr-notifications-quiet-box") as HTMLElement;
      const mark = (): string => getComputedStyle(list.querySelector(".tr-notifications-quiet-mark") as Element).visibility;
      const unchecked = mark();
      service.stateValue.set(new NotificationState([], true, 0));
      await fixture.whenStable();

      AppearanceFixture.expectLook(getComputedStyle(box).width, theme, "checkbox-size", "width");
      AppearanceFixture.expectLook(getComputedStyle(box).height, theme, "checkbox-size", "height");
      expect([unchecked, mark()]).toEqual(["hidden", "visible"]);
      AppearanceFixture.reset();
    });

  it("disables Clear all while every notification is in progress and reports an action that fails", async () => {
    service.stateValue.set(new NotificationState([notification(1, "clock.sync", "Syncing", { progress: 0.5, actions: ["clock.cancel"], isRead: true })], false, 0));
    service.failure = new Error("The clock stopped.");
    const fixture = await renderAsync();

    const list = await openAsync(fixture);
    const isClearDisabled = list.querySelector<HTMLButtonElement>(".tr-notifications-clear")?.disabled;
    list.querySelector<HTMLButtonElement>(".tr-notifications-action")?.click();
    await vi.waitFor(() => expect(errors.length).toBe(1));

    expect(isClearDisabled).toBe(true);
    expect((errors[0] as Error).message).toBe("The clock stopped.");
  });
});
