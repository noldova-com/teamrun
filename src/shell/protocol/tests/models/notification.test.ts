/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Notification, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationTests {
  private static readonly POST: NotificationPost = new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null);
  private static readonly TIME: string = "2026-10-03T08:00:00.000Z";

  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"id\":7,\"sequence\":12,\"post\":{\"kind\":\"clock.alarm\",\"title\":\"Alarm\",\"severity\":\"Info\",\"actions\":[]},\"postedAt\":\"2026-10-03T08:00:00.000Z\",\"isRead\":true}";

    const notification = Notification.fromJson(JSON.parse(text));

    Assert.areEqual([7, 12, "Alarm", NotificationTests.TIME, true].join("|"), [notification.id, notification.sequence, notification.post.title, notification.postedAt, notification.isRead].join("|"));
    Assert.areEqual(text, JSON.stringify(notification.toJson()));
  }

  @TestMethod
  public refusesAnIdOrSequenceBelowOneOrFractionalAndATimeThatIsNotADate(): void {
    Assert.areEqual(
      "id,id,sequence,sequence,postedAt",
      [
        () => new Notification(0, 1, NotificationTests.POST, NotificationTests.TIME, false),
        () => new Notification(1.5, 1, NotificationTests.POST, NotificationTests.TIME, false),
        () => new Notification(1, 0, NotificationTests.POST, NotificationTests.TIME, false),
        () => new Notification(1, 2.5, NotificationTests.POST, NotificationTests.TIME, false),
        () => new Notification(1, 1, NotificationTests.POST, "soon", false)
      ].map(t => Assert.throws(t, ArgumentException).parameterName).join(","));
  }

  @TestMethod
  public refusesMissingInvalidAndUnknownFields(): void {
    const valid = new Notification(1, 1, NotificationTests.POST, NotificationTests.TIME, false).toJson();

    Assert.areEqual("$.isRead", Assert.throws(() => Notification.fromJson({ id: 1, sequence: 1, post: NotificationTests.POST.toJson(), postedAt: NotificationTests.TIME }), JsonException).path);
    Assert.areEqual("$.sequence", Assert.throws(() => Notification.fromJson({ id: 1, post: NotificationTests.POST.toJson(), postedAt: NotificationTests.TIME, isRead: false }), JsonException).path);
    Assert.areEqual("$.post.title", Assert.throws(() => Notification.fromJson({ ...valid, post: { kind: "clock.alarm", severity: "Info", actions: [] } }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => Notification.fromJson({ ...valid, extra: 1 }), JsonException).path);
  }
}
