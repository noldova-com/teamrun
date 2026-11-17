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
import { SharedMcpSecret } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpSecretTests {
  @TestMethod
  public keepsAVariableItsReferenceAndWhenItWasSavedAndNoTimeForOneSavedBeforeTeamRunKeptIt(): void {
    const json = { variable: "GITHUB_TOKEN", reference: "teamrun.mcpSecret0123456789abcdef0123456789abcdef", updatedAt: "2026-11-01T10:00:00.000Z" };
    const { updatedAt: _, ...older } = json;

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpSecret.fromJson(json).toJson()));
    Assert.isNull(SharedMcpSecret.fromJson(older).updatedAt);
    Assert.isNull(new SharedMcpSecret(json.variable, json.reference).updatedAt);
    Assert.areEqual("$.s.reference", Assert.throws(() => SharedMcpSecret.fromJson({ variable: "GITHUB_TOKEN" }, "$.s"), JsonException).path);
  }

  @TestMethod
  public refusesANameThatIsntAVariableOrAReferenceOfAnotherForm(): void {
    Assert.areEqual("variable", Assert.throws(() => new SharedMcpSecret("1TOKEN", "teamrun.mcpSecret0123456789abcdef0123456789abcdef"), ArgumentException).parameterName);
    for (const reference of ["teamrun.mcpSecret", "teamrun.mcpSecret0123456789ABCDEF0123456789ABCDEF", "notes.mcpSecret0123456789abcdef0123456789abcdef",
      "teamrun.mcpSecret0123456789abcdef0123456789abcdef0", "ghp_0123456789abcdef"])
      Assert.areEqual("reference", Assert.throws(() => new SharedMcpSecret("GITHUB_TOKEN", reference), ArgumentException).parameterName);
  }
}
