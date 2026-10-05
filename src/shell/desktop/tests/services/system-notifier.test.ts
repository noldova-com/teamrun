/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SystemNotifier } from "@noldova/teamrun-shell-desktop";
import { Notification, NotificationBroadcast, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { FakeDesktopLog } from "../fixtures/fake-desktop-log.fixture.js";
import { FakeNotificationHost } from "../fixtures/fake-notification-host.fixture.js";

@TestClass
export class SystemNotifierTests {
  private static readonly DEVICE: string = "laptop";

  @TestMethod
  public showsAPostThatArrivesCompleteButNotOneStillInProgress(): void {
    const { host, notifier } = SystemNotifierTests.create();
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 0);

    notifier.receive(SystemNotifierTests.broadcast(
      [], SystemNotifierTests.notification(3, 3, "Exported", null, 1), SystemNotifierTests.notification(2, 2, "Exporting", null, 0.5),
      SystemNotifierTests.notification(1, 1, "Indexing", null, NotificationPost.indeterminate)));

    Assert.areEqual("Exported", host.created.map(t => t.title).join(","));
  }

  @TestMethod
  public showsOnlyWhatFollowsTheReadEvenFromABroadcastThatCameFirst(): void {
    const { host, notifier } = SystemNotifierTests.create();
    const epoch = notifier.epoch;
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(2, 2, "Saved", "Plan.md"), SystemNotifierTests.notification(1, 1, "Alarm")));
    const beforeRead = host.created.length;

    notifier.begin(epoch, SystemNotifierTests.DEVICE, 1);
    notifier.receive(SystemNotifierTests.broadcast(
      [], SystemNotifierTests.notification(3, 3, "Synced"), SystemNotifierTests.notification(2, 2, "Saved", "Plan.md"), SystemNotifierTests.notification(1, 1, "Alarm")));

    Assert.areEqual(0, beforeRead);
    Assert.areEqual(
      JSON.stringify([{ title: "Saved", body: "Plan.md", icon: "/teamrun/icon.png" }, { title: "Synced", body: "", icon: "/teamrun/icon.png" }]),
      JSON.stringify(host.open.map(t => t.options)));
  }

  @TestMethod
  public neverShowsAnUpdateWorkInProgressOrAnythingWhileFocusedQuietOrUnsupported(): void {
    const { host, notifier, focus } = SystemNotifierTests.create();
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 0);
    const alarm = SystemNotifierTests.notification(1, 1, "Alarm");
    notifier.receive(SystemNotifierTests.broadcast([], alarm));
    const shown = host.created.length;

    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(1, 1, "Alarm again")));
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(2, 2, "Syncing", null, 0.5), alarm));
    focus.isFocused = true;
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(3, 3, "Focused"), alarm));
    focus.isFocused = false;
    notifier.receive(SystemNotifierTests.broadcast([SystemNotifierTests.DEVICE], SystemNotifierTests.notification(4, 4, "Quiet"), alarm));
    host.isSupportedNow = false;
    notifier.receive(SystemNotifierTests.broadcast(["desk"], SystemNotifierTests.notification(5, 5, "Unsupported"), alarm));
    host.isSupportedNow = true;
    notifier.receive(SystemNotifierTests.broadcast(["desk"], SystemNotifierTests.notification(5, 5, "Unsupported"), alarm));

    Assert.areEqual("1|Alarm", `${shown}|${host.created.map(t => t.title).join(",")}`);
  }

  @TestMethod
  public closesOneThatIsDismissedOrReplacedAndForgetsOneThePersonClosed(): void {
    const { host, notifier } = SystemNotifierTests.create();
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 0);
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(2, 2, "Saved"), SystemNotifierTests.notification(1, 1, "Alarm")));
    const [alarm, saved] = host.created;

    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(2, 2, "Saved")));
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(2, 3, "Saved again")));
    host.created[2]?.close();
    notifier.receive(SystemNotifierTests.broadcast([]));

    Assert.areEqual("true,true,true", [alarm?.isClosed, saved?.isClosed, host.created[2]?.isClosed].join(","));
    Assert.areEqual("Alarm,Saved,Saved again", host.created.map(t => t.title).join(","));
  }

  @TestMethod
  public opensAClickedOneAndLogsOnlyTheFirstFailure(): void {
    const { host, notifier, log, opened } = SystemNotifierTests.create();
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 0);
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(2, 2, "Saved"), SystemNotifierTests.notification(1, 1, "Alarm")));
    const [alarm, saved] = host.created;

    alarm?.click();
    saved?.fail("The toast was blocked.");
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(3, 3, "Synced")));
    host.created[2]?.fail("The toast was blocked again.");

    Assert.areEqual("1", opened.join(","));
    Assert.areEqual("false,false", [alarm?.isClosed, saved?.isClosed].join(","));
    Assert.areEqual(JSON.stringify(["The operating system did not show a notification: The toast was blocked."]), JSON.stringify(log.lines));
  }

  @TestMethod
  public closesWhatItShowedWhenTheConnectionEndsAndIgnoresAReadStartedBefore(): void {
    const { host, notifier } = SystemNotifierTests.create();
    const stale = notifier.epoch;
    notifier.begin(stale, SystemNotifierTests.DEVICE, 0);
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(1, 1, "Alarm")));

    notifier.reset();
    notifier.begin(stale, SystemNotifierTests.DEVICE, 0);
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(1, 1, "New runtime")));
    const beforeRead = host.open.length;
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 0);

    Assert.areEqual("true|0", `${String(host.created[0]?.isClosed)}|${beforeRead}`);
    Assert.areEqual("New runtime", host.open.map(t => t.title).join(","));
  }

  @TestMethod
  public holdsWhatAReloadingWindowPostsUntilItsReadAndNeverCountsBackwards(): void {
    const { host, notifier } = SystemNotifierTests.create();
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 0);
    const alarm = SystemNotifierTests.notification(1, 1, "Alarm");
    notifier.receive(SystemNotifierTests.broadcast([], alarm));
    const beforeReload = notifier.epoch;

    notifier.hold();
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(2, 2, "Re-posted while loading"), alarm));
    notifier.begin(beforeReload, SystemNotifierTests.DEVICE, 0);
    const whileHeld = host.created.length;
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 2);
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 0);
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(2, 2, "Re-posted while loading"), alarm));
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(3, 3, "Posted after the read"), SystemNotifierTests.notification(2, 2, "Re-posted while loading"), alarm));

    Assert.areEqual(1, whileHeld);
    Assert.areEqual("Alarm,Posted after the read", host.created.map(t => t.title).join(","));
  }

  @TestMethod
  public showsNothingFromAMutedModuleAndNothingItPostedWhileMutedOnceUnmuted(): void {
    const { host, notifier } = SystemNotifierTests.create();
    notifier.begin(notifier.epoch, SystemNotifierTests.DEVICE, 0);
    const alarm = SystemNotifierTests.notification(1, 1, "Alarm");
    const saved = SystemNotifierTests.notification(2, 2, "Saved", null, null, "notes.saved");

    notifier.receive(new NotificationBroadcast([saved, alarm], [], ["clock"], 2));
    notifier.receive(SystemNotifierTests.broadcast([], SystemNotifierTests.notification(3, 3, "Alarm later"), saved, alarm));

    Assert.areEqual("Saved,Alarm later", host.created.map(t => t.title).join(","));
  }

  private static create(): { host: FakeNotificationHost; notifier: SystemNotifier; log: FakeDesktopLog; opened: string[]; focus: { isFocused: boolean } } {
    const host = new FakeNotificationHost();
    const log = new FakeDesktopLog();
    const opened: string[] = [];
    const focus = { isFocused: false };
    const notifier = new SystemNotifier(host, log, () => "/teamrun/icon.png", () => focus.isFocused, t => opened.push(t));
    return { host, notifier, log, opened, focus };
  }

  private static broadcast(quietDevices: readonly string[], ...notifications: Notification[]): NotificationBroadcast {
    return new NotificationBroadcast(notifications, quietDevices, [], Math.max(0, ...notifications.map(t => t.sequence)));
  }

  private static notification(id: number, sequence: number, title: string, text: string | null = null, progress: number | typeof NotificationPost.indeterminate | null = null,
    kind: string = "clock.alarm"): Notification {
    return new Notification(
      String(id), sequence, new NotificationPost(QualifiedName.parse(kind), null, title, text, NotificationSeverity.Info, null, [], progress), "2026-10-03T08:00:00.000Z", false);
  }
}
