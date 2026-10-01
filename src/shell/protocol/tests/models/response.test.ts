/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Failure, FailureCode, Response, WireMessageKind } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ResponseTests {
  @TestMethod
  public roundTripsASuccess(): void {
    const response = Response.fromJson(Response.success("r1", { count: 2 }).toJson());

    Assert.areEqual(WireMessageKind.Response, response.kind);
    Assert.areEqual("r1", response.id);
    Assert.isFalse(response.hasFailed);
    Assert.areEqual("{\"count\":2}", JSON.stringify(response.payload));
    Assert.isUndefined(response.failure);
    Assert.areEqual("{\"kind\":\"Response\",\"id\":\"r1\",\"payload\":{\"count\":2}}", response.toText());
  }

  @TestMethod
  public keepsANullPayloadApartFromAFailure(): void {
    const response = Response.fromJson(Response.success("r1", null).toJson());

    Assert.isFalse(response.hasFailed);
    Assert.isNull(response.payload);
    Assert.areEqual("{\"kind\":\"Response\",\"id\":\"r1\",\"payload\":null}", response.toText());
  }

  @TestMethod
  public roundTripsAFailureWithAnUnknownId(): void {
    const response = Response.fromJson(Response.failure(null, new Failure(FailureCode.InvalidMessage, "Unreadable.")).toJson());

    Assert.isNull(response.id);
    Assert.isTrue(response.hasFailed);
    Assert.isUndefined(response.payload);
    Assert.areEqual(FailureCode.InvalidMessage, response.failure?.code);
    Assert.areEqual("{\"kind\":\"Response\",\"id\":null,\"failure\":{\"code\":\"InvalidMessage\",\"message\":\"Unreadable.\"}}", response.toText());
  }

  @TestMethod
  public rejectsABlankId(): void {
    Assert.throws(() => Response.success(" ", null), ArgumentException);
    Assert.throws(() => Response.failure("", new Failure(FailureCode.Internal, "Failed.")), ArgumentException);
  }

  @TestMethod
  @TestData("{\"id\":\"r1\"}", "$", "A response must carry a payload or a failure.")
  @TestData("{\"id\":\"r1\",\"payload\":1,\"failure\":{\"code\":\"Internal\",\"message\":\"Failed.\"}}", "$", "A response cannot carry both a payload and a failure.")
  @TestData("{\"id\":\" \",\"payload\":1}", "$.id", "The value cannot be an empty string or composed entirely of whitespace.")
  @TestData("{\"id\":\"r1\",\"failure\":{\"code\":\"Unknown\",\"message\":\"Failed.\"}}", "$.failure.code", "Expected one of")
  @TestData("{\"payload\":1}", "$.id", "The field is required.")
  public rejectsAnInvalidWireForm(text: string, path: string, message: string): void {
    const failure = Assert.throws(() => Response.fromJson(JSON.parse(text)), JsonException);

    Assert.areEqual(path, failure.path);
    Assert.isTrue(failure.message.includes(message), failure.message);
  }
}
