/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ExecutableLocator } from "@noldova/teamrun-providers";
import { ProcessInspector, ProcessProbe, ProcessRegistry, ProviderRegistryFactory } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class ProviderRegistryFactoryTests {
  @TestMethod
  public registersAdaptersWithFixtureExecutables(): void {
    using directory = new TemporaryDirectory();
    writeFileSync(directory.resolve("codex"), "fixture");
    writeFileSync(directory.resolve("claude"), "fixture");
    const locator = new ExecutableLocator(process.platform, process.arch, [directory.path], directory.path);
    Assert.isNotNull(locator.locateCodex(null));
    Assert.isNotNull(locator.locateClaude(null));
    const tracker = new ProcessRegistry(directory.resolve("processes.json"), process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform));
    const registry = new ProviderRegistryFactory(process.platform, {}, locator).create("1.0.0", tracker, directory.path);
    Assert.areEqual("codex,claude,grok", registry.all().map(t => t.descriptor.id).join(","));
  }

  @TestMethod
  public registersAdaptersEvenWithoutExecutables(): void {
    using directory = new TemporaryDirectory();
    const locator = new ExecutableLocator(process.platform, process.arch, [], directory.path);

    const tracker = new ProcessRegistry(directory.resolve("processes.json"), process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform));
    const registry = new ProviderRegistryFactory(process.platform, {}, locator).create("1.0.0", tracker, directory.path);

    Assert.areEqual("codex,claude,grok", registry.all().map(t => t.descriptor.id).join(","));
    Assert.isTrue(registry.has("codex"));
  }
}
