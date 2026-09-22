/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ProviderRegistry } from "@noldova/teamrun-core";
import {
  AgentSdkQueryFactory,
  AppServerClientInfo,
  ClaudeAdapter,
  CodexAdapter,
  GrokAdapter,
  CommandRunner,
  ExecutableLocator,
  ExecutableVersionReader,
  type IProcessTracker,
  type LocatedExecutable,
  type ProcessCommand,
  ProcessTerminator,
  ProviderTimings
} from "@noldova/teamrun-providers";

import { Resources } from "../resources.js";

export class ProviderRegistryFactory {
  private readonly platform: string;
  private readonly baseEnvironment: NodeJS.ProcessEnv;
  private readonly locator: ExecutableLocator;

  public constructor(platform: string, baseEnvironment: NodeJS.ProcessEnv, locator: ExecutableLocator) {
    this.platform = platform;
    this.baseEnvironment = baseEnvironment;
    this.locator = locator;
  }

  public create(productVersion: string, tracker: IProcessTracker, dataDirectory: string): ProviderRegistry {
    const registry = new ProviderRegistry();
    const terminator = new ProcessTerminator(this.platform);
    const timings = ProviderTimings.createDefault();
    const runner = new CommandRunner(terminator);
    const clientInfo = new AppServerClientInfo(Resources.clientName, Resources.clientTitle, productVersion);
    const codexCommand = ProviderRegistryFactory.toCommand(this.locator.locateCodex(null));
    registry.register(new CodexAdapter(codexCommand, this.baseEnvironment, clientInfo, terminator, timings, tracker));
    registry.register(new ClaudeAdapter(
      ProviderRegistryFactory.toCommand(this.locator.locateClaude(null)),
      this.baseEnvironment,
      productVersion,
      new AgentSdkQueryFactory(),
      runner,
      new ExecutableVersionReader(runner, timings.versionTimeout),
      timings));
    registry.register(new GrokAdapter(ProviderRegistryFactory.toCommand(this.locator.locateGrok(null)), this.baseEnvironment,
      join(dataDirectory, ...Resources.grokProfileSegments), clientInfo, terminator, timings, tracker));

    return registry;
  }

  private static toCommand(executable: LocatedExecutable | null): ProcessCommand | null {
    return Object.isNull(executable) ? null : executable.toCommand();
  }
}
