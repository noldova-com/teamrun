/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { NotificationState } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationStateTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const notification = { id: 1, post: { kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false };
    const state = NotificationState.fromJson({ notifications: [notification], isDoNotDisturb: true });

    Assert.isTrue(state.isDoNotDisturb);
    Assert.areEqual(JSON.stringify({ notifications: [notification], isDoNotDisturb: true }), JSON.stringify(state.toJson()));
    Assert.areEqual("{\"notifications\":[],\"isDoNotDisturb\":false}", JSON.stringify(new NotificationState([], false).toJson()));
  }

  @TestMethod
  public refusesMissingAndUnknownFields(): void {
    Assert.areEqual("$.isDoNotDisturb", Assert.throws(() => NotificationState.fromJson({ notifications: [] }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationState.fromJson({ notifications: [], isDoNotDisturb: false, extra: 1 }), JsonException).path);
  }
}
