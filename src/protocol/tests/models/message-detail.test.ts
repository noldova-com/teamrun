/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetailKind, MessageDetail } from "@noldova/teamrun-protocol";

@TestClass
export class MessageDetailTests {
  @TestMethod
  public holdsOnePieceOfAMessage(): void {
    const detail = new MessageDetail(2, DetailKind.Command, "npm test", { exitCode: 0 }, "t");

    Assert.areEqual(2, detail.sequence);
    Assert.areEqual(DetailKind.Command, detail.kind);
    Assert.areEqual("npm test", detail.text);
    Assert.areEqual("{\"exitCode\":0}", JSON.stringify(detail.payload));
  }

  @TestMethod
  public allowsEmptyTextWhenTheContentIsInThePayload(): void {
    const detail = new MessageDetail(0, DetailKind.FileChange, String.empty, { paths: ["src/app.ts"] }, "t");

    Assert.areEqual(String.empty, detail.text);
  }

  @TestMethod
  public rejectsInvalidSequencesAndBlankTimestamps(): void {
    Assert.throws(() => new MessageDetail(-1, DetailKind.Text, "x", null, "t"), ArgumentOutOfRangeException);
    Assert.throws(() => new MessageDetail(0.5, DetailKind.Text, "x", null, "t"), ArgumentOutOfRangeException);
    Assert.throws(() => new MessageDetail(0, DetailKind.Text, "x", null, String.empty), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { sequence: 1, kind: "Error", text: "Provider disconnected.", payload: null, createdAt: "2026-09-08T09:00:09Z" };
    const detail = MessageDetail.fromJson(json);

    Assert.areEqual(DetailKind.Error, detail.kind);
    Assert.isNull(detail.payload);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(detail.toJson()));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const image = { sequence: 0, kind: "image", text: String.empty, payload: null, createdAt: "t" };
    const badKind = Assert.throws(() => MessageDetail.fromJson(image, "$.details.0"), JsonException);
    const missingPayload = Assert.throws(() => MessageDetail.fromJson({ sequence: 0, kind: "Text", text: String.empty, createdAt: "t" }), JsonException);

    Assert.areEqual("$.details.0.kind", badKind.path);
    Assert.areEqual("$.payload", missingPayload.path);
  }
}
