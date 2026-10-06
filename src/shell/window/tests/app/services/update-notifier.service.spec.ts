/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Notification, NotificationPost, NotificationSeverity, NotificationState, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { NotificationService } from "../../../src/app/services/notification.service";
import { UpdateNotifierService } from "../../../src/app/services/update-notifier.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("UpdateNotifierService", () => {
  let errors: unknown[];
  let bridge: DesktopBridgeFixture;
  let firstRead: WritableSignal<NotificationState | null>;
  let notifications: WritableSignal<NotificationState>;

  const update = (kind: string, fields: object = {}): object => ({ kind, version: null, progress: null, checkedAt: null, reason: null, mustMove: false, ...fields });
  const posts = (): readonly (readonly [string, string, string, string, string])[] => bridge.requests.filter(t => t[0] === "shell.postNotification").map(([, payload]) => {
    const post = NotificationPost.fromJson(payload);
    return [post.kind.text, String(post.key), post.title, `${post.open?.name.text} ${JsonReader.fromValue(post.open?.commandArguments).readString("page")}`,
      post.actions.map(t => `${t.title}: ${t.command.name.text}`).join(",")] as const;
  });
  const existing = (kind: string, key: string): Notification =>
    new Notification("1", 1, new NotificationPost(QualifiedName.parse(kind), key, "Earlier", null, NotificationSeverity.Info, null, [], null), "2026-10-06T08:00:00.000Z", true);

  function start(): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: NotificationService, useValue: { firstRead, state: notifications } }
      ]
    });
    TestBed.inject(UpdateNotifierService);
    TestBed.tick();
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
    firstRead = signal(null);
    notifications = signal(new NotificationState([], false, [], 0));
  });

  afterEach(() => DesktopBridgeFixture.remove());

  it("posts once per version that an update is ready, after the window first read the notifications", async () => {
    bridge.update = update("Ready", { version: "1.3.0" });
    start();
    await settleAsync(() => true);

    expect(posts()).toEqual([]);

    firstRead.set(new NotificationState([], false, [], 0));
    await settleAsync(() => posts().length === 1);
    bridge.publishUpdate(update("Checking"));
    bridge.publishUpdate(update("Downloading", { version: "1.4.0", progress: 50 }));
    bridge.publishUpdate(update("Ready", { version: "1.3.0", reason: "A module's save failed." }));
    bridge.publishUpdate(update("Ready", { version: "1.4.0" }));
    await settleAsync(() => posts().length === 2);

    expect(posts()).toEqual([
      ["shell.updateReady", "1.3.0", "TeamRun 1.3.0 is ready to install", "shell.openSettings About", "Restart to update: shell.restartToUpdate"],
      ["shell.updateReady", "1.4.0", "TeamRun 1.4.0 is ready to install", "shell.openSettings About", "Restart to update: shell.restartToUpdate"]
    ]);
  });

  it("posts nothing for an update that isn't ready or for a version the list already holds", async () => {
    firstRead.set(new NotificationState([], false, [], 0));
    notifications.set(new NotificationState([existing("shell.updateReady", "1.4.0")], false, [], 1));
    bridge.update = update("Available", { version: "1.3.0", mustMove: true });
    start();
    await settleAsync(() => true);
    for (const state of [update("Ready", { version: "1.4.0" }), update("Failed", { version: "1.4.0" }), update("Ready", { version: "1.4.0" })]) {
      bridge.publishUpdate(state);
      await settleAsync(() => true);
    }

    expect(posts()).toEqual([]);
  });

  it("reports a post the runtime refuses", async () => {
    firstRead.set(new NotificationState([], false, [], 0));
    bridge.answer = { failure: { code: "Refused", message: "Refused." } };
    bridge.update = update("Ready", { version: "1.3.0" });

    start();
    await settleAsync(() => errors.length === 1);

    expect(errors.length).toBe(1);
  });
});
