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
    "n1", 2, new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null), "2026-10-03T08:00:00.000Z", false);

  @TestMethod
  public pinsItsWireFormAndGivesEachDeviceItsOwnState(): void {
    const source = ["laptop"];
    const broadcast = NotificationBroadcast.fromJson(new NotificationBroadcast([NotificationBroadcastTests.NOTIFICATION], source, ["clock"], 2).toJson());
    source.push("desk");

    Assert.areEqual(
      "{\"notifications\":[{\"id\":\"n1\",\"sequence\":2,\"post\":{\"kind\":\"clock.alarm\",\"title\":\"Alarm\",\"severity\":\"Info\",\"actions\":[]},\"postedAt\":\"2026-10-03T08:00:00.000Z\",\"isRead\":false}],\"quietDevices\":[\"laptop\"],\"mutedModules\":[\"clock\"],\"sequence\":2}",
      JSON.stringify(broadcast.toJson()));
    Assert.areEqual("true,false", [broadcast.stateFor("laptop").isDoNotDisturb, broadcast.stateFor("desk").isDoNotDisturb].join(","));
    Assert.areEqual("1|clock|2", `${broadcast.stateFor("desk").notifications.length}|${broadcast.stateFor("desk").mutedModules.join(",")}|${broadcast.stateFor("desk").sequence}`);
  }

  @TestMethod
  public refusesABlankDeviceOrModuleANegativeSequenceAndInvalidFields(): void {
    Assert.areEqual("quietDevices", Assert.throws(() => new NotificationBroadcast([], [" "], [], 0), ArgumentException).parameterName);
    Assert.areEqual("mutedModules", Assert.throws(() => new NotificationBroadcast([], [], [""], 0), ArgumentException).parameterName);
    Assert.areEqual("sequence", Assert.throws(() => new NotificationBroadcast([], [], [], -1), ArgumentException).parameterName);
    Assert.areEqual("$.quietDevices", Assert.throws(() => NotificationBroadcast.fromJson({ notifications: [], mutedModules: [], sequence: 0 }), JsonException).path);
    Assert.areEqual("$.mutedModules", Assert.throws(() => NotificationBroadcast.fromJson({ notifications: [], quietDevices: [], sequence: 0 }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationBroadcast.fromJson({ notifications: [], quietDevices: [], mutedModules: [], sequence: 0, extra: 1 }), JsonException).path);
  }
}
