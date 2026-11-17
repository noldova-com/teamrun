/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatPlanFirstParams } from "@noldova/teamrun.protocol";

@TestClass
export class ChatPlanFirstParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new ChatPlanFirstParams("chat-1", true).toJson();

    Assert.areEqual(JSON.stringify({ chatId: "chat-1", planFirst: true }), JSON.stringify(ChatPlanFirstParams.fromJson(json).toJson()));
    Assert.isFalse(ChatPlanFirstParams.fromJson({ ...json, planFirst: false }).planFirst);
    Assert.areEqual("$.input.planFirst", Assert.throws(() => ChatPlanFirstParams.fromJson({ ...json, planFirst: "yes" }, "$.input"), JsonException).path);
    Assert.areEqual("$.planFirst", Assert.throws(() => ChatPlanFirstParams.fromJson({ chatId: "chat-1" }), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("chatId", Assert.throws(() => new ChatPlanFirstParams(" ", true), ArgumentException).parameterName);
  }
}
