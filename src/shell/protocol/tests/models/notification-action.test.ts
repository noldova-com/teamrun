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
import { CommandRun, NotificationAction, QualifiedName } from "@noldova/teamrun-shell-protocol";

@TestClass
export class NotificationActionTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"title\":\"Show\",\"command\":{\"name\":\"clock.tick\",\"arguments\":{\"by\":2}}}";

    const action = NotificationAction.fromJson(JSON.parse(text));

    Assert.areEqual("Show", action.title);
    Assert.areEqual("clock.tick", action.command.name.text);
    Assert.areEqual(text, JSON.stringify(action.toJson()));
  }

  @TestMethod
  public refusesABlankTitleAndInvalidFields(): void {
    Assert.areEqual("title", Assert.throws(() => new NotificationAction(" ", new CommandRun(QualifiedName.parse("clock.tick"), null)), ArgumentException).parameterName);
    Assert.areEqual("$.extra", Assert.throws(() => NotificationAction.fromJson({ title: "Show", command: { name: "clock.tick", arguments: null }, extra: 1 }), JsonException).path);
    Assert.areEqual("$.command.name", Assert.throws(() => NotificationAction.fromJson({ title: "Show", command: { name: "tick", arguments: null } }), JsonException).path);
  }
}
