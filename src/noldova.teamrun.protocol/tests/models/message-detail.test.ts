/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, MessageDetail, Resources } from "@noldova/teamrun.protocol";

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

  @TestMethod
  public namesTheSubAgentItBelongsToAndKeepsTheFieldOutForTheReplysOwn(): void {
    const json = { sequence: 4, kind: "Command", text: "ls", payload: null, createdAt: "t", parentSequence: 2 };
    const nested = MessageDetail.fromJson(json);
    const own = MessageDetail.fromJson({ sequence: 1, kind: "Text", text: "Hi", payload: null, createdAt: "t", parentSequence: null });

    Assert.areEqual(2, nested.parentSequence);
    Assert.isTrue(nested.isNested);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(nested.toJson()));
    Assert.isNull(own.parentSequence);
    Assert.isFalse(own.isNested);
    Assert.isFalse(Object.hasOwn(own.toJson(), "parentSequence"));
  }

  @TestMethod
  public rejectsAParentThatIsntAnEarlierDetail(): void {
    for (const parent of [-1, 1.5, 3, 4])
      Assert.throws(() => new MessageDetail(3, DetailKind.Note, "x", null, "t", parent), ArgumentOutOfRangeException);
    Assert.throws(() => MessageDetail.fromJson({ sequence: 3, kind: "Note", text: "x", payload: null, createdAt: "t", parentSequence: "2" }), JsonException);
  }

  @TestMethod
  public keepsTheReplysTextItsOwn(): void {
    const error = Assert.throws(() => new MessageDetail(3, DetailKind.Text, "x", null, "t", 2), ArgumentException);

    Assert.areEqual(Resources.parentSequenceField, error.parameterName);
    Assert.areEqual(JSON.stringify([null, 2]), JSON.stringify([new MessageDetail(3, DetailKind.Text, "x", null, "t").parentSequence,
      new MessageDetail(3, DetailKind.Reasoning, "x", null, "t", 2).parentSequence]));
  }
}
