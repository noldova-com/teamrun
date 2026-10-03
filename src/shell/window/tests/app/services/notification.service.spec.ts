/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { CommandRun, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { CommandContribution } from "../../../src/app/models/command-contribution";
import { CommandService } from "../../../src/app/services/command.service";
import { NotificationService } from "../../../src/app/services/notification.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("NotificationService", () => {
  let errors: unknown[];
  let bridge: DesktopBridgeFixture;

  const notification = (id: number, title: string, isRead: boolean): object =>
    ({ id, sequence: id, post: { kind: "clock.alarm", title, severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead });
  const state = (isDoNotDisturb: boolean, ...notifications: object[]): object => ({ notifications, isDoNotDisturb, sequence: notifications.length });

  function start(): NotificationService {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    const service = TestBed.inject(NotificationService);
    TestBed.tick();
    return service;
  }

  async function settleAsync(isDone: () => boolean): Promise<void> {
    await vi.waitFor(() => {
      TestBed.tick();
      expect(isDone()).toBe(true);
    });
  }

  beforeEach(() => {
    errors = [];
    bridge = DesktopBridgeFixture.install();
  });

  afterEach(() => DesktopBridgeFixture.remove());

  it("reads the state once the window parts activate, counts what is unread and reads it again after a reconnection", async () => {
    bridge.responses.set("shell.notifications", { payload: state(true, notification(2, "Second", false), notification(1, "First", true)) });
    const service = start();

    await settleAsync(() => service.state().notifications.length === 2);
    const unread = service.unreadCount();
    const first = service.firstRead();
    bridge.responses.set("shell.notifications", { payload: state(false) });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(() => service.state().notifications.length === 0);

    expect(unread).toBe(1);
    expect(first?.sequence).toBe(2);
    expect([service.state().isDoNotDisturb, service.firstRead()?.sequence]).toEqual([false, 0]);
    expect(bridge.requests.map(t => t[0])).toEqual(["shell.modules", "shell.commands", "shell.notifications", "shell.modules", "shell.commands", "shell.notifications"]);
  });

  it("reports a first read that fails", async () => {
    bridge.responses.set("shell.notifications", { failure: { code: "Unavailable", message: "Not connected." } });

    start();
    await settleAsync(() => errors.length === 1);

    expect((errors[0] as Error).message).toContain("Not connected.");
  });

  it("follows the notifications event, ignores other events and reports one it cannot read", async () => {
    const service = start();
    await settleAsync(() => !Object.is(service.firstRead(), null));

    bridge.publishEvent("shell.notifications", state(true, notification(3, "Third", false)));
    bridge.publishEvent("clock.ticked", { ticks: 1 });
    bridge.publishEvent("shell.notifications", { notifications: [] });

    expect(service.state().notifications.map(t => t.post.title)).toEqual(["Third"]);
    expect(service.state().isDoNotDisturb).toBe(true);
    expect(errors.length).toBe(1);
  });

  it("keeps an event that arrives while its first read is pending over the older answer, but counts from the answer", async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.responses.set("shell.notifications", new Promise(resolve => {
      answer = resolve;
    }));
    const service = start();
    await settleAsync(() => bridge.requests.some(t => t[0] === "shell.notifications"));

    bridge.publishEvent("shell.notifications", state(false, notification(5, "Newer", false), notification(4, "Older", false)));
    answer({ payload: state(false, notification(4, "Older", false)) });
    await settleAsync(() => !Object.is(service.firstRead(), null));

    expect(service.state().notifications.map(t => t.post.title)).toEqual(["Newer", "Older"]);
    expect(service.firstRead()?.sequence).toBe(1);
  });

  it("asks the runtime to mark read, clear, dismiss and switch Do not disturb, and reports a request that fails", async () => {
    const service = start();
    await settleAsync(() => !Object.is(service.firstRead(), null));
    bridge.responses.set("shell.clearNotifications", { failure: { code: "Unavailable", message: "Not connected." } });

    service.markAllRead();
    service.clear();
    service.dismiss(7);
    service.setDoNotDisturb(true);
    await vi.waitFor(() => expect(errors.length).toBe(1));

    expect(bridge.requests.slice(-4)).toEqual([
      ["shell.markNotificationsRead", null],
      ["shell.clearNotifications", null],
      ["shell.dismissNotification", { id: 7 }],
      ["shell.setDoNotDisturb", { isOn: true }]
    ]);
  });

  it("knows which actions can run and runs them through the commands", async () => {
    const service = start();
    TestBed.inject(CommandService).setCommands([new CommandContribution("notes.newNote", "New note", null, null, async t => `ran ${JSON.stringify(t)}`)]);
    const newNote = new CommandRun(QualifiedName.parse("notes.newNote"), { folder: "inbox" });

    expect([service.isAvailable(newNote), service.isAvailable(new CommandRun(QualifiedName.parse("clock.tick"), null))]).toEqual([true, false]);
    expect(await service.runAsync(newNote)).toBe("ran {\"folder\":\"inbox\"}");
  });
});
