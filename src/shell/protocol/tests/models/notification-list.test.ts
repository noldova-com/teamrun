/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Notification, NotificationList, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationListTests {
  @TestMethod
  public pinsItsWireFormAndKeepsItsOwnCopyInOrder(): void {
    const post = new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null);
    const source = [new Notification(2, 2, post, "2026-10-03T08:01:00.000Z", false), new Notification(1, 1, post, "2026-10-03T08:00:00.000Z", true)];

    const list = new NotificationList(source);
    source.pop();

    Assert.areEqual("2,1", NotificationList.fromJson(list.toJson()).notifications.map(t => t.id).join(","));
    Assert.areEqual("{\"notifications\":[]}", JSON.stringify(new NotificationList([]).toJson()));
  }

  @TestMethod
  public refusesUnknownFieldsAndInvalidNotifications(): void {
    Assert.areEqual("$.extra", Assert.throws(() => NotificationList.fromJson({ notifications: [], extra: 1 }), JsonException).path);
    Assert.areEqual("$.notifications.0.id", Assert.throws(() => NotificationList.fromJson({ notifications: [{}] }), JsonException).path);
  }
}
