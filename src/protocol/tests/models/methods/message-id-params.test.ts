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
import { MessageIdParams } from "@noldova/teamrun-protocol";

@TestClass
export class MessageIdParamsTests {
  private static readonly json: object = { messageId: "msg-2" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = MessageIdParams.fromJson(MessageIdParamsTests.json);

    Assert.areEqual(JSON.stringify(MessageIdParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new MessageIdParams(String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => MessageIdParams.fromJson({ ...MessageIdParamsTests.json, messageId: String.empty }), JsonException);

    Assert.areEqual("$.messageId", exception.path);
  }
}
