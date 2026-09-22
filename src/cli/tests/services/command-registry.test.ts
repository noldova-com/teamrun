/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRegistry, StatusCommand } from "@noldova/teamrun-cli";

@TestClass
export class CommandRegistryTests {
  @TestMethod
  public registersEveryDefaultCommandOnce(): void {
    const registry = CommandRegistry.createDefault();

    const names = registry.all().map(t => t.name);

    Assert.areEqual(32, names.length);
    Assert.areEqual("help", names[0]);
    Assert.areEqual("status", registry.find("status")?.name);
    Assert.isNull(registry.find("nope"));
    Assert.areEqual("command", Assert.throws(() => registry.register(new StatusCommand()), ArgumentException).parameterName);
  }
}
