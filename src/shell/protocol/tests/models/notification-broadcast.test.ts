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
import { Notification, NotificationBroadcast, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationBroadcastTests {
  private static readonly NOTIFICATION: Notification = new Notification(
    1, new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null), "2026-10-03T08:00:00.000Z", false);

  @TestMethod
  public pinsItsWireFormAndGivesEachDeviceItsOwnState(): void {
    const source = ["laptop"];
    const broadcast = NotificationBroadcast.fromJson(new NotificationBroadcast([NotificationBroadcastTests.NOTIFICATION], source).toJson());
    source.push("desk");

    Assert.areEqual(
      "{\"notifications\":[{\"id\":1,\"post\":{\"kind\":\"clock.alarm\",\"title\":\"Alarm\",\"severity\":\"Info\",\"actions\":[]},\"postedAt\":\"2026-10-03T08:00:00.000Z\",\"isRead\":false}],\"quietDevices\":[\"laptop\"]}",
      JSON.stringify(broadcast.toJson()));
    Assert.areEqual("true,false", [broadcast.stateFor("laptop").isDoNotDisturb, broadcast.stateFor("desk").isDoNotDisturb].join(","));
    Assert.areEqual(1, broadcast.stateFor("desk").notifications.length);
  }

  @TestMethod
  public refusesABlankDeviceAndInvalidFields(): void {
    Assert.areEqual("quietDevices", Assert.throws(() => new NotificationBroadcast([], [" "]), ArgumentException).parameterName);
    Assert.areEqual("$.quietDevices", Assert.throws(() => NotificationBroadcast.fromJson({ notifications: [] }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationBroadcast.fromJson({ notifications: [], quietDevices: [], extra: 1 }), JsonException).path);
  }
}
