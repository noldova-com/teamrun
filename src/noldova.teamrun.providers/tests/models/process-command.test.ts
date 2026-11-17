/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessCommand, ProcessOrigin } from "@noldova/teamrun.providers";

@TestClass
export class ProcessCommandTests {
  @TestMethod
  public copiesArgumentsAndAppendsMore(): void {
    const args = ["a"];
    const command = new ProcessCommand("node", args);
    args.push("mutated");

    const extended = command.withArguments("b", "c");

    Assert.areEqual("a", command.arguments.join(","));
    Assert.areEqual("a,b,c", extended.arguments.join(","));
    Assert.areEqual("node", extended.executable);
    Assert.areEqual("executable", Assert.throws(() => new ProcessCommand(" ", []), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsOriginWhenArgumentsAreAppendedAndHasNoneUnlessGiven(): void {
    const origin = new ProcessOrigin("codex", "a1");
    const command = new ProcessCommand("codex", ["app-server"]).withOrigin(origin);

    const extended = command.withArguments("--json");

    Assert.isNull(new ProcessCommand("codex", []).origin);
    Assert.areEqual(origin, extended.origin);
    Assert.areEqual("app-server,--json", extended.arguments.join(","));
    Assert.areEqual("codex", extended.executable);
    Assert.isNull(new ProcessOrigin("claude", null).providerId);
    Assert.areEqual("kind", Assert.throws(() => new ProcessOrigin(" ", "a1"), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsVerbatimFormWhenArgumentsOrTheOriginChangeAndQuotesUnlessGiven(): void {
    const command = new ProcessCommand("cmd.exe", ["/d"], null, true);

    const changed = command.withArguments("/s").withOrigin(new ProcessOrigin("teamrun", null));

    Assert.isFalse(new ProcessCommand("cmd.exe", []).isVerbatim);
    Assert.isTrue(changed.isVerbatim);
    Assert.areEqual("/d,/s", changed.arguments.join(","));
  }

  @TestMethod
  public keepsItsOwnGroupWhenArgumentsOrTheOriginChangeAndItsVerbatimFormInItsOwnGroup(): void {
    const command = new ProcessCommand("cmd.exe", ["/d"], null, true).inOwnGroup();

    const changed = command.withArguments("/s").withOrigin(new ProcessOrigin("teamrun", null));

    Assert.isFalse(new ProcessCommand("cmd.exe", []).ownsGroup);
    Assert.isTrue(command.isVerbatim);
    Assert.isTrue(changed.ownsGroup);
    Assert.areEqual("/d,/s", changed.arguments.join(","));
  }
}
