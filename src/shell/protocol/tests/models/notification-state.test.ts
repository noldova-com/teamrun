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
import { NotificationState } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationStateTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const notification = { id: 1, sequence: 3, post: { kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false };
    const json = { notifications: [notification], isDoNotDisturb: true, mutedModules: ["clock"], sequence: 3 };
    const state = NotificationState.fromJson(json);

    Assert.areEqual("true|clock|3", `${String(state.isDoNotDisturb)}|${state.mutedModules.join(",")}|${state.sequence}`);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(state.toJson()));
    Assert.areEqual("{\"notifications\":[],\"isDoNotDisturb\":false,\"mutedModules\":[],\"sequence\":0}", JSON.stringify(new NotificationState([], false, [], 0).toJson()));
  }

  @TestMethod
  public refusesABlankMutedModuleANegativeSequenceAndMissingAndUnknownFields(): void {
    Assert.areEqual("mutedModules", Assert.throws(() => new NotificationState([], false, [" "], 0), ArgumentException).parameterName);
    Assert.areEqual("sequence", Assert.throws(() => new NotificationState([], false, [], -1), ArgumentException).parameterName);
    Assert.areEqual("$.isDoNotDisturb", Assert.throws(() => NotificationState.fromJson({ notifications: [], mutedModules: [], sequence: 0 }), JsonException).path);
    Assert.areEqual("$.mutedModules", Assert.throws(() => NotificationState.fromJson({ notifications: [], isDoNotDisturb: false, sequence: 0 }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationState.fromJson({ notifications: [], isDoNotDisturb: false, mutedModules: [], sequence: 0, extra: 1 }), JsonException).path);
  }
}
