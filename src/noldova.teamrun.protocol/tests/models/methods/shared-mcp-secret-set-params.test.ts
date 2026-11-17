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
import { SharedMcpSecretSetParams } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpSecretSetParamsTests {
  @TestMethod
  public preservesAReferenceOrNullForTheEnvironment(): void {
    for (const reference of ["teamrun.mcpSecret0123456789abcdef0123456789abcdef", null]) {
      const json = new SharedMcpSecretSetParams("s1", "GITHUB_TOKEN", reference).toJson();
      Assert.areEqual(JSON.stringify({ serverId: "s1", variable: "GITHUB_TOKEN", reference }), JSON.stringify(SharedMcpSecretSetParams.fromJson(json).toJson()));
    }
    Assert.areEqual("$.p.reference", Assert.throws(() => SharedMcpSecretSetParams.fromJson({ serverId: "s1", variable: "A", reference: 1 }, "$.p"),
      JsonException).path);
  }

  @TestMethod
  public refusesABlankServerANameThatIsntAVariableOrAReferenceOfAnotherForm(): void {
    Assert.throws(() => new SharedMcpSecretSetParams(" ", "A", null), ArgumentException);
    Assert.areEqual("variable", Assert.throws(() => new SharedMcpSecretSetParams("s1", "", null), ArgumentException).parameterName);
    Assert.areEqual("reference", Assert.throws(() => new SharedMcpSecretSetParams("s1", "A", "ghp_value"), ArgumentException).parameterName);
  }
}
