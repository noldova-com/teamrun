/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { Notification, NotificationPost, NotificationSeverity, NotificationState, QualifiedName } from "@noldova/teamrun-shell-protocol";

import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import type { IWindowPartContext } from "../../../src/app/interfaces/i-window-part-context";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { NotificationService } from "../../../src/app/services/notification.service";
import { ToastService } from "../../../src/app/services/toast.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

class FakeNotificationService {
  public readonly stateValue: WritableSignal<NotificationState> = signal(new NotificationState([], false, [], 0));
  public readonly firstReadValue: WritableSignal<NotificationState | null> = signal(null);
  public readonly state = this.stateValue.asReadonly();
  public readonly firstRead = this.firstReadValue.asReadonly();
}

describe("ToastService", () => {
  let notifications: FakeNotificationService;
  let isFocused: boolean;

  const notification = (
    id: number,
    kind: string,
    options: Partial<{ sequence: number; severity: NotificationSeverity; text: string; progress: number | typeof NotificationPost.indeterminate; isRead: boolean }> = {}): Notification =>
    new Notification(String(id), options.sequence ?? id, new NotificationPost(
      QualifiedName.parse(kind), null, `Title ${id}`, options.text ?? null, options.severity ?? NotificationSeverity.Info, null, [], options.progress ?? null),
    "2026-10-03T08:00:00.000Z", options.isRead ?? false);
  const latest = (list: readonly Notification[]): number => Math.max(0, ...list.map(t => t.sequence));

  function start(...existing: Notification[]): ToastService {
    const state = new NotificationState(existing, false, [], latest(existing));
    notifications.stateValue.set(state);
    notifications.firstReadValue.set(state);
    const service = TestBed.inject(ToastService);
    TestBed.tick();
    return service;
  }

  function post(isQuiet: boolean, ...list: Notification[]): void {
    notifications.stateValue.set(new NotificationState(list, isQuiet, [], latest(list)));
    TestBed.tick();
  }

  const shown = (service: ToastService): number[] => service.toasts().map(t => Number(t.id));

  beforeEach(() => {
    vi.useFakeTimers();
    notifications = new FakeNotificationService();
    isFocused = true;
    vi.spyOn(document, "hasFocus").mockImplementation(() => isFocused);
    TestBed.configureTestingModule({ providers: [{ provide: NotificationService, useValue: notifications }] });
  });

  afterEach(() => {
    if (vi.isFakeTimers())
      vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("toasts only what has a higher sequence than the first read and announces it, errors assertively", () => {
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce").mockResolvedValue();
    const service = start(notification(1, "clock.alarm"));

    post(false, notification(2, "notes.saved", { text: "Plan.md" }), notification(1, "clock.alarm"));
    post(false, notification(3, "notes.failed", { severity: NotificationSeverity.Error, text: "The disk is full." }), notification(2, "notes.saved", { text: "Plan.md" }), notification(1, "clock.alarm"));

    expect(shown(service)).toEqual([2, 3]);
    expect(announce.mock.calls).toEqual([["Title 2. Plan.md", "polite"], ["Title 3. The disk is full.", "assertive"]]);
  });

  it("announces the toasts one update shows in one announcement, assertively when any of them is an error", () => {
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), "announce").mockResolvedValue();
    const service = start(notification(1, "clock.alarm"));

    post(false, notification(3, "notes.saved"), notification(2, "notes.failed", { severity: NotificationSeverity.Error, text: "The disk is full" }), notification(1, "clock.alarm"));

    expect(shown(service)).toEqual([2, 3]);
    expect(announce.mock.calls).toEqual([["Title 2. The disk is full. Title 3", "assertive"]]);
  });

  it("waits for the first read, then toasts only what follows it, even when it saw newer state first", () => {
    const service = TestBed.inject(ToastService);
    post(false, notification(2, "notes.saved"), notification(1, "clock.alarm"));
    post(false, notification(3, "notes.moved"), notification(2, "notes.saved"), notification(1, "clock.alarm"));

    notifications.firstReadValue.set(new NotificationState([notification(2, "notes.saved"), notification(1, "clock.alarm")], false, [], 2));
    TestBed.tick();

    expect(shown(service)).toEqual([3]);
  });

  it("counts from a new first read after the runtime restarts its sequence", () => {
    const service = start(notification(4, "clock.alarm", { severity: NotificationSeverity.Warning }));

    notifications.firstReadValue.set(new NotificationState([], false, [], 0));
    post(false);
    post(false, notification(1, "notes.saved", { severity: NotificationSeverity.Warning }));

    expect(shown(service)).toEqual([1]);
  });

  it("toasts nothing while the window is not focused, Do not disturb is on or the notification was read", () => {
    const service = start();

    isFocused = false;
    post(false, notification(1, "clock.alarm"));
    isFocused = true;
    post(true, notification(2, "notes.saved"), notification(1, "clock.alarm"));
    post(false, notification(3, "notes.read", { isRead: true }), notification(2, "notes.saved"), notification(1, "clock.alarm"));

    expect(shown(service)).toEqual([]);
  });

  it("toasts nothing from a muted module and still toasts the others", () => {
    const service = start();

    notifications.stateValue.set(new NotificationState([notification(2, "notes.saved"), notification(1, "clock.alarm")], false, ["clock"], 2));
    TestBed.tick();

    expect(shown(service)).toEqual([2]);
  });

  it("toasts at most one notification of a kind every five seconds", () => {
    const service = start();

    const first = notification(1, "clock.alarm");
    post(false, first);
    vi.advanceTimersByTime(4_999);
    const second = notification(2, "clock.alarm");
    post(false, second, first);
    vi.advanceTimersByTime(1);
    post(false, notification(3, "clock.alarm"), second, first);

    expect(shown(service)).toEqual([1, 3]);
  });

  it("shows at most three, queues the rest, and shows the next when one closes, skipping one that is gone", () => {
    const service = start();
    const list = [5, 4, 3, 2, 1].map(t => notification(t, `notes.kind${t}`, { severity: NotificationSeverity.Warning }));

    post(false, ...list);
    const firstThree = shown(service);
    notifications.stateValue.set(new NotificationState(list.filter(t => t.id !== "4"), false, [], 5));
    service.close("1");
    TestBed.tick();

    expect(firstThree).toEqual([1, 2, 3]);
    expect(shown(service)).toEqual([2, 3, 5]);
  });

  it("closes information and success after eight seconds, paused while hovered, and keeps warnings, errors and work in progress", () => {
    const service = start();
    post(false,
      notification(4, "clock.sync", { progress: 0.5 }),
      notification(3, "notes.failed", { severity: NotificationSeverity.Error }),
      notification(2, "notes.saved", { severity: NotificationSeverity.Success }),
      notification(1, "clock.alarm"));
    service.close("4");
    post(false, notification(4, "clock.sync", { progress: 0.5 }), notification(3, "notes.failed", { severity: NotificationSeverity.Error }), notification(2, "notes.saved", { severity: NotificationSeverity.Success }));

    vi.advanceTimersByTime(3_000);
    service.pause("1");
    service.pause("1");
    vi.advanceTimersByTime(10_000);
    const whilePaused = shown(service);
    service.resume("1");
    service.resume("1");
    vi.advanceTimersByTime(4_999);
    const beforeEnd = shown(service);
    vi.advanceTimersByTime(1);

    expect(whilePaused).toEqual([3]);
    expect(beforeEnd).toEqual([3]);
    expect(shown(service)).toEqual([3]);
  });

  it("closes work in progress eight seconds after it finishes, toasts a re-post again and drops a dismissed one", () => {
    const service = start();
    post(false, notification(1, "clock.sync", { progress: NotificationPost.indeterminate }));
    vi.advanceTimersByTime(20_000);
    const working = shown(service);

    post(false, notification(1, "clock.sync", { progress: 1 }));
    vi.advanceTimersByTime(8_000);
    const finished = shown(service);
    vi.advanceTimersByTime(5_000);
    post(false, notification(1, "clock.sync", { sequence: 2, severity: NotificationSeverity.Warning }));
    const reposted = shown(service);
    post(false);

    expect([working, finished, reposted]).toEqual([[1], [], [1]]);
    expect(shown(service)).toEqual([]);
  });

  it("clears its timers when the window goes away", () => {
    const service = start();
    post(false, notification(1, "clock.alarm"));

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
    expect(shown(service)).toEqual([1]);
  });
});

describe("ToastService with the window parts", () => {
  const wire = (id: number, title: string): object => ({ id: String(id), sequence: id, post: { kind: "notes.saved", title, severity: "Warning", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false });

  afterEach(() => {
    DesktopBridgeFixture.remove();
    vi.restoreAllMocks();
  });

  it("toasts nothing a part posted without awaiting while it activated, and toasts what is posted after the first read", async () => {
    const bridge = DesktopBridgeFixture.install();
    const errors: unknown[] = [];
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    let answerPost: (value: unknown) => void = () => undefined;
    bridge.responses.set("shell.modules", { payload: { modules: [{ id: "notes", version: "0.0.1", displayName: "Notes", description: "Keeps notes.", dependencies: [], contributes: {}, state: "Active" }] } });
    bridge.responses.set("shell.postNotification", new Promise(resolve => {
      answerPost = resolve;
    }));
    let isActivated = false;
    const part: IWindowPart = {
      moduleId: "notes",
      activateAsync: (context: IWindowPartContext) => {
        void context.postNotificationAsync(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Early", null, NotificationSeverity.Warning, null, [], null));
        isActivated = true;
        return Promise.resolve();
      },
      reconnectAsync: () => Promise.resolve(false),
      deactivateAsync: () => Promise.resolve()
    };
    const source = new WindowPartSource("notes", [], [], [], [], [], [], ["notes.saved"], () => Promise.resolve(part));
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }, { provide: WindowPartTokens.sources, useValue: [source] }]
    });
    const service = TestBed.inject(ToastService);
    TestBed.tick();
    await vi.waitFor(() => expect(isActivated).toBe(true));

    bridge.responses.set("shell.notifications", { payload: { notifications: [wire(1, "Early")], isDoNotDisturb: false, mutedModules: [], sequence: 1 } });
    bridge.publishEvent("shell.notifications", { notifications: [wire(1, "Early")], isDoNotDisturb: false, mutedModules: [], sequence: 1 });
    const readsBeforeAnswer = bridge.requests.filter(t => t[0] === "shell.notifications").length;
    answerPost({ payload: { id: "1" } });
    await vi.waitFor(() => {
      TestBed.tick();
      expect(TestBed.inject(NotificationService).firstRead()?.sequence).toBe(1);
    });
    bridge.publishEvent("shell.notifications", { notifications: [wire(2, "Later"), wire(1, "Early")], isDoNotDisturb: false, mutedModules: [], sequence: 2 });
    TestBed.tick();

    expect(readsBeforeAnswer).toBe(0);
    expect(errors).toEqual([]);
    expect(service.toasts().map(t => t.post.title)).toEqual(["Later"]);
  });
});
