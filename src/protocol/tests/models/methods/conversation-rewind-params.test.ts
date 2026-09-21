/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ConversationRewindParams } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationRewindParamsTests {
  private static readonly json: object = { conversationId: "conv-1", messageId: "msg-4", restoreFiles: true };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationRewindParams.fromJson(ConversationRewindParamsTests.json);

    Assert.areEqual(JSON.stringify(ConversationRewindParamsTests.json), JSON.stringify(value.toJson()));
    Assert.isTrue(value.restoreFiles);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new ConversationRewindParams(String.empty, "msg-4", false), ArgumentException);
    Assert.throws(() => new ConversationRewindParams("conv-1", " ", false), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ConversationRewindParams.fromJson({ ...ConversationRewindParamsTests.json, restoreFiles: "yes" }), JsonException);

    Assert.areEqual("$.restoreFiles", exception.path);
  }
}
