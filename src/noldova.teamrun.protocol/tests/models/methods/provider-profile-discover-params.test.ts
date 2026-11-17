/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderProfileDiscoverParams } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderProfileDiscoverParamsTests {
  @TestMethod
  public asksForEveryKindOrTheNamedOnes(): void {
    const named = new ProviderProfileDiscoverParams(["claude", "codex"]);

    Assert.isNull(new ProviderProfileDiscoverParams().kinds);
    Assert.isNull(ProviderProfileDiscoverParams.fromJson(null).kinds);
    Assert.isNull(ProviderProfileDiscoverParams.fromJson({}).kinds);
    Assert.isNull(ProviderProfileDiscoverParams.fromJson({ kinds: null }).kinds);
    Assert.areEqual("claude,codex", ProviderProfileDiscoverParams.fromJson(named.toJson()).kinds?.join(","));
    Assert.areEqual(JSON.stringify({ kinds: null }), JSON.stringify(new ProviderProfileDiscoverParams().toJson()));
  }

  @TestMethod
  public refusesABlankKindWithItsPath(): void {
    Assert.areEqual("kinds", Assert.throws(() => new ProviderProfileDiscoverParams(["codex", " "]), ArgumentException).parameterName);
    Assert.areEqual("$.kinds.0", Assert.throws(() => ProviderProfileDiscoverParams.fromJson({ kinds: [1] }), JsonException).path);
  }
}
