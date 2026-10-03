/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type NotificationList, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { NotificationCenter, RegistrationException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class NotificationCenterTests {
  @TestMethod
  public keepsNotificationsNewestFirstUnreadAndTimedAndReportsEachChange(): void {
    const { center, published } = NotificationCenterTests.create();

    const first = center.post(NotificationCenterTests.post("clock.alarm", null, "First"));
    const second = center.post(NotificationCenterTests.post("notes.saved", null, "Second"));

    Assert.areEqual("1,2", [first, second].join(","));
    Assert.areEqual("2:Second:00:00:02:false,1:First:00:00:01:false", NotificationCenterTests.describe(center.list));
    Assert.areEqual("1,2", published.map(t => t.notifications.length).join(","));
  }

  @TestMethod
  public replacesTheSameKindAndKeyAtTheTopWithItsIdButNeverAKeylessOne(): void {
    const { center } = NotificationCenterTests.create();
    const morning = center.post(NotificationCenterTests.post("clock.alarm", "morning", "Wake up"));
    center.post(NotificationCenterTests.post("clock.alarm", "evening", "Wind down"));
    center.post(NotificationCenterTests.post("clock.alarm", null, "Keyless"));
    center.post(NotificationCenterTests.post("clock.alarm", null, "Keyless"));

    const again = center.post(NotificationCenterTests.post("clock.alarm", "morning", "Wake up now"));
    center.post(NotificationCenterTests.post("notes.saved", "morning", "Other kind"));

    Assert.areEqual(morning, again);
    Assert.areEqual(
      "5:Other kind:00:00:06:false,1:Wake up now:00:00:05:false,4:Keyless:00:00:04:false,3:Keyless:00:00:03:false,2:Wind down:00:00:02:false",
      NotificationCenterTests.describe(center.list));
  }

  @TestMethod
  public updatesInPlaceKeepingItsTimeButRefusesAnotherKindAndReportsAMissingOne(): void {
    const { center, published } = NotificationCenterTests.create();
    const id = center.post(NotificationCenterTests.post("clock.sync", null, "Syncing", 0.25));
    center.post(NotificationCenterTests.post("notes.saved", null, "Saved"));

    const isUpdated = center.update(id, NotificationCenterTests.post("clock.sync", null, "Synced", 1));
    const changed = Assert.throws(() => center.update(id, NotificationCenterTests.post("notes.saved", null, "Saved")), RegistrationException);

    Assert.isTrue(isUpdated);
    Assert.areEqual("2:Saved:00:00:02:false,1:Synced:00:00:01:false", NotificationCenterTests.describe(center.list));
    Assert.areEqual(1, center.list.notifications[1]?.post.progress);
    Assert.areEqual("Notification 1 is of the kind clock.sync, which an update keeps.", changed.message);
    Assert.isFalse(center.update(9, NotificationCenterTests.post("clock.sync", null, "Gone")));
    Assert.areEqual(3, published.length);
  }

  @TestMethod
  public dismissesOneOrAModulesAndReportsOnlyARealChange(): void {
    const { center, published } = NotificationCenterTests.create();
    const alarm = center.post(NotificationCenterTests.post("clock.alarm", null, "Alarm"));
    center.post(NotificationCenterTests.post("clock.sync", null, "Sync"));
    center.post(NotificationCenterTests.post("notes.saved", null, "Saved"));

    center.dismiss(alarm);
    center.dismiss(alarm);
    center.dismissOwnedBy("clock");
    center.dismissOwnedBy("calendar");

    Assert.areEqual("3:Saved:00:00:03:false", NotificationCenterTests.describe(center.list));
    Assert.areEqual(5, published.length);
  }

  @TestMethod
  public keepsAHundredDroppingTheOldestFinishedButNeverWorkInProgress(): void {
    const { center } = NotificationCenterTests.create();
    center.post(NotificationCenterTests.post("clock.sync", "a", "Indeterminate", NotificationPost.indeterminate));
    center.post(NotificationCenterTests.post("clock.sync", "b", "Half", 0.5));
    center.post(NotificationCenterTests.post("clock.sync", "c", "Done", 1));
    for (let index = 0; index < 98; index++)
      center.post(NotificationCenterTests.post("notes.saved", null, `Saved ${index}`));

    const titles = center.list.notifications.map(t => t.post.title);

    Assert.areEqual(100, titles.length);
    Assert.areEqual("Saved 97,Half,Indeterminate", [titles[0], titles.at(-2), titles.at(-1)].join(","));
    Assert.isFalse(titles.includes("Done"));
  }

  @TestMethod
  public goesPastAHundredWhenEveryOldOneIsStillInProgress(): void {
    const { center } = NotificationCenterTests.create();

    for (let index = 0; index < 101; index++)
      center.post(NotificationCenterTests.post("clock.sync", null, `Working ${index}`, NotificationPost.indeterminate));

    Assert.areEqual(101, center.list.notifications.length);
  }

  private static create(): { center: NotificationCenter; published: NotificationList[] } {
    const published: NotificationList[] = [];
    let seconds = 0;
    const center = new NotificationCenter(t => published.push(t), () => new Date(Date.UTC(2026, 9, 3, 0, 0, ++seconds)));
    return { center, published };
  }

  private static post(kind: string, key: string | null, title: string, progress: number | typeof NotificationPost.indeterminate | null = null): NotificationPost {
    return new NotificationPost(QualifiedName.parse(kind), key, title, null, NotificationSeverity.Info, null, [], progress);
  }

  private static describe(list: NotificationList): string {
    return list.notifications.map(t => `${t.id}:${t.post.title}:${t.postedAt.slice(11, 19)}:${String(t.isRead)}`).join(",");
  }
}
