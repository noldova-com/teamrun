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
import { BuildIdentity, Handshake, WireMessageKind } from "@noldova/teamrun-shell-protocol";

@TestClass
export class HandshakeTests {
  @TestMethod
  public roundTripsItsWireForm(): void {
    const handshake = Handshake.fromJson(new Handshake("h1", new BuildIdentity("0.0.1", 1, "abc"), "secret", "desktop").toJson());

    Assert.areEqual(WireMessageKind.Handshake, handshake.kind);
    Assert.areEqual("h1", handshake.id);
    Assert.areEqual("abc", handshake.identity.fingerprint);
    Assert.areEqual("secret", handshake.token);
    Assert.areEqual("desktop", handshake.client);
    Assert.areEqual(
      "{\"kind\":\"Handshake\",\"id\":\"h1\",\"identity\":{\"productVersion\":\"0.0.1\",\"protocolVersion\":1,\"fingerprint\":\"abc\"},\"token\":\"secret\",\"client\":\"desktop\"}",
      handshake.toText());
  }

  @TestMethod
  @TestData(" ", "secret", "desktop")
  @TestData("h1", " ", "desktop")
  @TestData("h1", "secret", " ")
  public rejectsBlankFields(id: string, token: string, client: string): void {
    Assert.throws(() => new Handshake(id, new BuildIdentity("0.0.1", 1, "abc"), token, client), ArgumentException);
  }

  @TestMethod
  @TestData("{\"kind\":\"Handshake\",\"id\":\"h1\",\"identity\":{\"productVersion\":\"0.0.1\",\"protocolVersion\":1,\"fingerprint\":\"abc\"},\"token\":\"t\",\"client\":\"cli\",\"scope\":\"all\"}", "$.scope")
  @TestData("{\"id\":\"h1\",\"identity\":{\"productVersion\":\"0.0.1\",\"protocolVersion\":1,\"fingerprint\":\"abc\",\"admin\":true},\"token\":\"t\",\"client\":\"cli\"}", "$.identity.admin")
  public rejectsUnknownFields(text: string, path: string): void {
    const failure = Assert.throws(() => Handshake.fromJson(JSON.parse(text)), JsonException);

    Assert.areEqual(path, failure.path);
    Assert.isTrue(failure.message.includes("accepts no unknown fields"), failure.message);
  }

  @TestMethod
  public namesTheInvalidFieldOnTheWire(): void {
    const identity = { productVersion: "0.0.1", protocolVersion: 1, fingerprint: "abc" };

    Assert.areEqual("$.token", Assert.throws(() => Handshake.fromJson({ id: "h1", identity, token: "", client: "cli" }), JsonException).path);
    Assert.areEqual("$.identity.fingerprint", Assert.throws(() => Handshake.fromJson({ id: "h1", identity: { ...identity, fingerprint: 1 }, token: "t", client: "cli" }), JsonException).path);
    Assert.areEqual("$.identity", Assert.throws(() => Handshake.fromJson({ id: "h1", token: "t", client: "cli" }), JsonException).path);
  }
}
