/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Endpoint, EndpointKind } from "@noldova/teamrun-shell-runtime";

@TestClass
export class EndpointTests {
  private static readonly SOCKET: string = path.resolve("data", "discovery", "runtime.sock");

  @TestMethod
  public describesALoopbackPort(): void {
    const endpoint = Endpoint.tcp(65_535);

    Assert.areEqual(EndpointKind.Tcp, endpoint.kind);
    Assert.areEqual(65_535, endpoint.port);
    Assert.isNull(endpoint.path);
    Assert.areEqual("tcp://127.0.0.1:65535", endpoint.toString());
  }

  @TestMethod
  public describesALocalSocket(): void {
    const endpoint = Endpoint.socket(EndpointTests.SOCKET);

    Assert.areEqual(EndpointKind.Socket, endpoint.kind);
    Assert.isNull(endpoint.port);
    Assert.areEqual(EndpointTests.SOCKET, endpoint.path);
    Assert.areEqual(EndpointTests.SOCKET, endpoint.toString());
  }

  @TestMethod
  public rejectsPortsOutsideTheValidRange(): void {
    Assert.throws(() => Endpoint.tcp(0), ArgumentOutOfRangeException);
    Assert.throws(() => Endpoint.tcp(1.5), ArgumentOutOfRangeException);
    const exception = Assert.throws(() => Endpoint.tcp(65_536), ArgumentOutOfRangeException);

    Assert.areEqual("port", exception.parameterName);
  }

  @TestMethod
  public rejectsARelativeSocketPath(): void {
    const exception = Assert.throws(() => Endpoint.socket(path.join("data", "runtime.sock")), ArgumentException);

    Assert.areEqual("path", exception.parameterName);
  }

  @TestMethod
  public parsesWhatItWrites(): void {
    Assert.areEqual("tcp://127.0.0.1:4100", Endpoint.parse("tcp://127.0.0.1:4100").toString());
    Assert.areEqual(4100, Endpoint.parse("tcp://127.0.0.1:4100").port);
    Assert.areEqual(EndpointTests.SOCKET, Endpoint.parse(EndpointTests.SOCKET).path);
  }

  @TestMethod
  public rejectsTextThatIsNoEndpoint(): void {
    for (const text of ["tcp://127.0.0.1:", "tcp://127.0.0.1:0", "tcp://127.0.0.1:080", "tcp://127.0.0.1:123456", "tcp://127.0.0.1:12a"]) {
      const exception = Assert.throws(() => Endpoint.parse(text), ArgumentException, text);
      Assert.areEqual(`"${text}" is not a TeamRun endpoint. (Parameter 'text')`, exception.message);
    }
    Assert.throws(() => Endpoint.parse("tcp://127.0.0.1:99999"), ArgumentOutOfRangeException);
    Assert.throws(() => Endpoint.parse("tcp://localhost:4100"), ArgumentException);
  }
}
