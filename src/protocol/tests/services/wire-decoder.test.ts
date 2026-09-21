/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, Event, Hello, ProtocolVersion, Request, Response, WireDecoder } from "@noldova/teamrun-protocol";

@TestClass
export class WireDecoderTests {
  @TestMethod
  public decodesAHello(): void {
    const decoded = new WireDecoder().decodeText(new Hello(new ProtocolVersion(1, 0), "token", "cli").toText());

    Assert.isInstanceOf(decoded, Hello);
    Assert.areEqual("token", decoded.token);
    Assert.areEqual("cli", decoded.client);
    Assert.isTrue(decoded.version.equals(new ProtocolVersion(1, 0)));
  }

  @TestMethod
  public decodesARequest(): void {
    const decoded = new WireDecoder().decodeText(new Request("r1", "MessageSend", { text: "hi" }).toText());

    Assert.isInstanceOf(decoded, Request);
    Assert.areEqual("r1", decoded.id);
    Assert.areEqual("MessageSend", decoded.method);
    Assert.areEqual("{\"text\":\"hi\"}", JSON.stringify(decoded.payload));
  }

  @TestMethod
  public decodesSuccessesAndFailures(): void {
    const success = new WireDecoder().decodeText(Response.success("r1", null).toText());
    const failure = new WireDecoder().decodeText(Response.failure(null, new ServiceResponseInfo(ErrorCode.Unauthorized, "The token is not valid.")).toText());

    Assert.isInstanceOf(success, Response);
    Assert.areEqual("r1", success.id);
    Assert.isFalse(success.hasErrors);
    Assert.isInstanceOf(failure, Response);
    Assert.isNull(failure.id);
    Assert.areEqual(ErrorCode.Unauthorized, failure.info?.name);
  }

  @TestMethod
  public decodesAnEvent(): void {
    const decoded = new WireDecoder().decodeText(new Event("message/detail", { id: "m1" }).toText());

    Assert.isInstanceOf(decoded, Event);
    Assert.areEqual("message/detail", decoded.name);
  }

  @TestMethod
  public decodesAlreadyParsedValues(): void {
    const decoded = new WireDecoder().decodeValue({ kind: "Event", name: "message/detail", payload: null });

    Assert.isInstanceOf(decoded, Event);
    Assert.isNull(decoded.payload);
  }

  @TestMethod
  public rejectsUnknownAndMissingKinds(): void {
    const decoder = new WireDecoder();

    Assert.areEqual("$.kind", Assert.throws(() => decoder.decodeValue({ kind: "Error" }), JsonException).path);
    Assert.areEqual("$.kind", Assert.throws(() => decoder.decodeValue({ id: "r1" }), JsonException).path);
    Assert.areEqual("$", Assert.throws(() => decoder.decodeText("not json"), JsonException).path);
  }
}
