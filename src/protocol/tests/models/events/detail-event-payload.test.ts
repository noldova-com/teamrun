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
import { DetailEventPayload } from "@noldova/teamrun-protocol";

@TestClass
export class DetailEventPayloadTests {
  private static readonly json: object = { messageId: "msg-2", detail: { sequence: 0, kind: "Text", text: "Done.", payload: null, createdAt: "t" } };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = DetailEventPayload.fromJson(DetailEventPayloadTests.json);

    Assert.areEqual(JSON.stringify(DetailEventPayloadTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = DetailEventPayload.fromJson(DetailEventPayloadTests.json);

    Assert.throws(() => new DetailEventPayload(String.empty, valid.detail), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => DetailEventPayload.fromJson({ ...DetailEventPayloadTests.json, detail: { sequence: 0 } }), JsonException);

    Assert.areEqual("$.detail.kind", exception.path);
  }
}
