/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Endpoint, EndpointKind } from "@noldova/teamrun-runtime";

@TestClass
export class EndpointTests {
  @TestMethod
  public describesAndRoundTripsBothKinds(): void {
    const tcp = Endpoint.tcp(4321);
    const socket = Endpoint.socket("/tmp/runtime.sock");

    Assert.areEqual("127.0.0.1:4321", tcp.describe());
    Assert.areEqual("/tmp/runtime.sock", socket.describe());
    Assert.areEqual("{\"kind\":\"Tcp\",\"port\":4321,\"path\":null}", JSON.stringify(tcp.toJson()));
    Assert.areEqual(EndpointKind.Socket, Endpoint.fromJson(socket.toJson()).kind);
    Assert.areEqual(4321, Endpoint.fromJson({ kind: "Tcp", port: 4321 }).port);
    Assert.isNull(Endpoint.fromJson({ kind: "Socket", path: "p" }).port);
  }

  @TestMethod
  public rejectsMismatchedValues(): void {
    Assert.areEqual("port", Assert.throws(() => new Endpoint(EndpointKind.Tcp, null, null), ArgumentException).parameterName);
    Assert.areEqual("port", Assert.throws(() => new Endpoint(EndpointKind.Tcp, 1, "p"), ArgumentException).parameterName);
    Assert.areEqual("path", Assert.throws(() => new Endpoint(EndpointKind.Socket, null, null), ArgumentException).parameterName);
    Assert.areEqual("path", Assert.throws(() => new Endpoint(EndpointKind.Socket, 1, "p"), ArgumentException).parameterName);
    Assert.throws(() => Endpoint.tcp(0), ArgumentOutOfRangeException);
    Assert.throws(() => Endpoint.socket(" "), ArgumentException);
    Assert.throws(() => Endpoint.fromJson({ kind: "udp", port: 1 }), JsonException);
  }
}
