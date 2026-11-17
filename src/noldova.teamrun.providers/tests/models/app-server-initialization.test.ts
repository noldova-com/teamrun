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
import { AppServerInitialization } from "@noldova/teamrun.providers";

@TestClass
export class AppServerInitializationTests {
  @TestMethod
  public readsTheVersionFromTheUserAgent(): void {
    const versioned = AppServerInitialization.fromJson({ userAgent: "codex-cli/0.153.4 (Windows)" });
    const prerelease = new AppServerInitialization("codex_cli_rs/0.154.0-alpha.2 (Windows)");
    const unversioned = new AppServerInitialization("codex");

    Assert.areEqual("0.153.4", versioned.version);
    Assert.areEqual("0.154.0-alpha.2", prerelease.version);
    Assert.isNull(unversioned.version);
    Assert.areEqual("userAgent", Assert.throws(() => new AppServerInitialization(" "), ArgumentException).parameterName);
    Assert.throws(() => AppServerInitialization.fromJson({}), JsonException);
  }
}
