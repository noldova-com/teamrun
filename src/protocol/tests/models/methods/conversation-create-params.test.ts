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
import { ConversationCreateParams } from "@noldova/teamrun-protocol";

@TestClass
export class ConversationCreateParamsTests {
  private static readonly json: object = { projectId: "prj-1", title: null };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ConversationCreateParams.fromJson(ConversationCreateParamsTests.json);

    Assert.areEqual(JSON.stringify(ConversationCreateParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ConversationCreateParams.fromJson(ConversationCreateParamsTests.json);

    Assert.throws(() => new ConversationCreateParams(String.empty, valid.title), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ConversationCreateParams.fromJson({ ...ConversationCreateParamsTests.json, title: 7 }), JsonException);

    Assert.areEqual("$.title", exception.path);
  }
}
