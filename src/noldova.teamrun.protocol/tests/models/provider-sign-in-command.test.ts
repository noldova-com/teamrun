/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpAgentIdParams, AcpLocalCommandAddParams, ProviderSignInCommand, SharedMcpSecret } from "@noldova/teamrun.protocol";

const REFERENCE = "teamrun.mcpSecret0123456789abcdef0123456789abcdef";

@TestClass
export class ProviderSignInCommandTests {
  @TestMethod
  public keepsItsCommandAndEnvironment(): void {
    const command = new ProviderSignInCommand("droid login", { PATH: "bin" });

    const read = ProviderSignInCommand.fromJson(JSON.parse(JSON.stringify(command.toJson())) as unknown);

    Assert.areEqual("droid login|bin", `${read.command}|${read.environment["PATH"]}`);
    Assert.areEqual("command", Assert.throws(() => new ProviderSignInCommand(" ", {}), ArgumentException).parameterName);
    Assert.areEqual("$.c.environment", Assert.throws(() => ProviderSignInCommand.fromJson({ command: "droid" }, "$.c"), JsonException).path);
  }

  @TestMethod
  public keepsAnAgentsIdAndALocalCommandWithItsValuesReferencesOnly(): void {
    const local = new AcpLocalCommandAddParams("Mine", "node", ["a.js"], [new SharedMcpSecret("KEY", REFERENCE)]);

    const read = AcpLocalCommandAddParams.fromJson(JSON.parse(JSON.stringify(local.toJson())) as unknown);

    Assert.areEqual("droid", AcpAgentIdParams.fromJson(new AcpAgentIdParams("droid").toJson()).id);
    Assert.areEqual(`Mine|node|a.js|KEY|${REFERENCE}`, [read.name, read.command, read.arguments.join(","), read.secrets[0]!.variable, read.secrets[0]!.reference].join("|"));
    Assert.areEqual("id", Assert.throws(() => new AcpAgentIdParams(" "), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new AcpLocalCommandAddParams(" ", "node", [], []), ArgumentException).parameterName);
    Assert.areEqual("command", Assert.throws(() => new AcpLocalCommandAddParams("Mine", " ", [], []), ArgumentException).parameterName);
    Assert.areEqual("$.p.secrets", Assert.throws(() => AcpLocalCommandAddParams.fromJson({ name: "Mine", command: "node", arguments: [] }, "$.p"), JsonException).path);
  }
}
