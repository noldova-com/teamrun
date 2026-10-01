/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DiscoveryFormatException, RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";

@TestClass
export class RuntimeDiscoveryTests {
  @TestMethod
  public writesEveryFieldWithTheFormatVersion(): void {
    const discovery = new RuntimeDiscovery("/tmp/teamrun.sock", "token", 12, "/usr/bin/node", "0.0.1", 3, "build");

    Assert.areEqual(
      "{\"formatVersion\":1,\"endpoint\":\"/tmp/teamrun.sock\",\"token\":\"token\",\"processId\":12,\"executablePath\":\"/usr/bin/node\",\"productVersion\":\"0.0.1\",\"protocolVersion\":3,\"build\":\"build\"}",
      JSON.stringify(discovery.toJson()));
    Assert.areEqual("/tmp/teamrun.sock", discovery.endpoint);
    Assert.areEqual("token", discovery.token);
    Assert.areEqual(12, discovery.processId);
    Assert.areEqual("/usr/bin/node", discovery.executablePath);
    Assert.areEqual("0.0.1", discovery.productVersion);
    Assert.areEqual(3, discovery.protocolVersion);
    Assert.areEqual("build", discovery.build);
  }

  @TestMethod
  public refusesEmptyTextAndNonPositiveNumbers(): void {
    Assert.throws(() => new RuntimeDiscovery(" ", "token", 1, "node", "0.0.1", 1, "build"), ArgumentException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "", 1, "node", "0.0.1", 1, "build"), ArgumentException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 0, "node", "0.0.1", 1, "build"), ArgumentOutOfRangeException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 1, "", "0.0.1", 1, "build"), ArgumentException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 1, "node", "", 1, "build"), ArgumentException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 1, "node", "0.0.1", 1.5, "build"), ArgumentOutOfRangeException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 1, "node", "0.0.1", 1, ""), ArgumentException);
  }

  @TestMethod
  public readsItsOwnJsonBack(): void {
    const discovery = new RuntimeDiscovery("/tmp/teamrun.sock", "token", 12, "/usr/bin/node", "0.0.1", 3, "build");

    Assert.areEqual(JSON.stringify(discovery.toJson()), JSON.stringify(RuntimeDiscovery.fromJson(JSON.parse(JSON.stringify(discovery.toJson()))).toJson()));
  }

  @TestMethod
  public refusesAnythingButAnObjectOfTheKnownFormatVersion(): void {
    for (const value of [null, [], "text", 1])
      Assert.areEqual("The discovery metadata is not a JSON object.", Assert.throws(() => RuntimeDiscovery.fromJson(value), DiscoveryFormatException).message);
    const versions: readonly (readonly [object, string])[] = [[{}, "undefined"], [{ formatVersion: 2 }, "2"], [{ formatVersion: "1" }, "1"]];
    for (const [value, version] of versions)
      Assert.areEqual(
        `The discovery metadata has the unsupported format version ${version}.`,
        Assert.throws(() => RuntimeDiscovery.fromJson(value), DiscoveryFormatException).message);
  }

  @TestMethod
  public namesTheFirstMissingOrInvalidField(): void {
    const valid = { formatVersion: 1, endpoint: "e", token: "t", processId: 1, executablePath: "n", productVersion: "0.0.1", protocolVersion: 1, build: "b" };
    const cases: readonly (readonly [object, string])[] = [
      [{ ...valid, endpoint: undefined }, "endpoint"],
      [{ ...valid, endpoint: 1 }, "endpoint"],
      [{ ...valid, token: " " }, "token"],
      [{ ...valid, processId: undefined }, "processId"],
      [{ ...valid, processId: "1" }, "processId"],
      [{ ...valid, processId: 1.5 }, "processId"],
      [{ ...valid, processId: 0 }, "processId"],
      [{ ...valid, executablePath: undefined }, "executablePath"],
      [{ ...valid, productVersion: undefined }, "productVersion"],
      [{ ...valid, protocolVersion: undefined }, "protocolVersion"],
      [{ ...valid, build: undefined }, "build"]
    ];
    for (const [value, field] of cases)
      Assert.areEqual(
        `The discovery metadata's ${field} is missing or invalid.`,
        Assert.throws(() => RuntimeDiscovery.fromJson(JSON.parse(JSON.stringify(value))), DiscoveryFormatException).message);
  }
}
