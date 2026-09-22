/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { ProviderRegistry } from "@noldova/teamrun-core";
import { ExecutableLocator, type IProcessTracker } from "@noldova/teamrun-providers";

import { RuntimeSettings } from "../models/runtime-settings.js";
import { Resources } from "../resources.js";
import { ProcessProbe } from "./lock/process-probe.js";
import { ProcessInspector } from "./processes/process-inspector.js";
import { ProcessRegistry } from "./processes/process-registry.js";
import { ProviderRegistryFactory } from "./provider-registry-factory.js";
import { RuntimeService } from "./runtime.service.js";
import { InstallationRegistry } from "./installation-registry.js";

export class RuntimeEntry {
  private readonly args: readonly string[];
  private readonly platform: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(args: readonly string[], platform: string, environment: NodeJS.ProcessEnv) {
    this.args = [...args];
    this.platform = platform;
    this.environment = environment;
  }

  public static get entryPath(): string {
    return fileURLToPath(import.meta.url);
  }

  public createSettings(): RuntimeSettings {
    const dataDirectory = this.readOption(Resources.dataDirectoryArgument);
    if (Object.isUndefined(dataDirectory))
      throw new ArgumentException(Resources.dataDirectoryRequired, Resources.dataDirectoryParameterName);

    const idleGrace = this.readOption(Resources.idleGraceArgument);
    const productVersion = this.readOption(Resources.productVersionArgument) ?? Resources.defaultProductVersion;
    const idleGraceMilliseconds = Object.isUndefined(idleGrace) ? Resources.idleGrace : Number(idleGrace);
    return RuntimeSettings.forPlatform(this.platform, resolve(dataDirectory), productVersion, idleGraceMilliseconds);
  }

  public createRegistry(productVersion: string, tracker: IProcessTracker): ProviderRegistry {
    const providers = this.readOption(Resources.providersArgument);
    if (Object.isUndefined(providers))
      return new ProviderRegistryFactory(this.platform, this.environment, ExecutableLocator.fromProcess()).create(productVersion, tracker, this.createSettings().dataDirectory);
    if (providers === Resources.noProvidersValue)
      return new ProviderRegistry();

    throw new ArgumentException(Resources.formatUnknownArgumentValue(Resources.providersArgument, providers), Resources.providersArgument);
  }

  public get stopsOnInputEnd(): boolean {
    return this.args.includes(Resources.stopOnInputEndArgument);
  }

  public async run(input: NodeJS.ReadableStream, signals: NodeJS.EventEmitter): Promise<string> {
    const settings = this.createSettings();
    const processes = new ProcessRegistry(settings.processesPath, process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(this.platform));
    const installation = InstallationRegistry.forEntry(RuntimeEntry.entryPath, this.environment[Resources.appImageVariable] ?? process.execPath, homedir())
      ?? InstallationRegistry.forDataDirectory(settings.dataDirectory, homedir());
    installation?.assertLaunchAllowed();
    const service = new RuntimeService(settings, this.createRegistry(settings.productVersion, processes), processes, installation);
    const stop = (reason: string): void => {
      void service.stop(reason);
    };
    signals.on(Resources.interruptSignal, () => stop(Resources.stoppedBySignal));
    signals.on(Resources.terminateSignal, () => stop(Resources.stoppedBySignal));
    if (this.stopsOnInputEnd) {
      input.on(Resources.endEvent, () => stop(Resources.stoppedByInputEnd));
      input.resume();
    }
    await service.start();

    return service.waitForStop();
  }

  private readOption(name: string): string | undefined {
    const index = this.args.indexOf(name);
    return index < 0 ? undefined : this.args[index + 1];
  }
}

if (!Object.isUndefined(process.argv[1]) && resolve(process.argv[1]) === RuntimeEntry.entryPath) {
  const reason = await new RuntimeEntry(process.argv.slice(2), process.platform, process.env).run(process.stdin, process);
  if (reason === Resources.stoppedForUpdate)
    process.exit(0);
}
