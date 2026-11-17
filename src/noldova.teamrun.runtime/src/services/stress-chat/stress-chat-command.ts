/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { DataDirectory } from "@noldova/desktop.runtime";

import { RuntimePartException } from "../../exceptions/runtime-part.exception.js";
import { StressChatResources } from "./stress-chat-resources.js";
import { StressChatSeeder } from "./stress-chat-seeder.js";

export class StressChatCommand {
  private readonly appFolder: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly homeFolder: string;
  private readonly output: Writable;

  public constructor(appFolder: string, environment: NodeJS.ProcessEnv, homeFolder: string, output: Writable) {
    this.appFolder = appFolder;
    this.environment = environment;
    this.homeFolder = homeFolder;
    this.output = output;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    const pairs = StressChatCommand.readPairs(commandArguments);
    if (Object.isNull(pairs)) {
      this.output.write(StressChatResources.usage);
      return StressChatResources.usageExitCode;
    }

    try {
      const started = Date.now();
      const project = await new StressChatSeeder(await this.locateAsync(), this.output).seedAsync(pairs);
      this.output.write(StressChatResources.formatSeeded(pairs, project.rootPath, Date.now() - started));
      return 0;
    }
    catch (error) {
      if (!(error instanceof RuntimePartException))
        throw error;
      this.output.write(`${error.message}\n`);
      return StressChatResources.failureExitCode;
    }
  }

  private async locateAsync(): Promise<DataDirectory> {
    const product = JsonReader.parse(await readFile(join(this.appFolder, StressChatResources.manifestFileName), StressChatResources.utf8Encoding))
      .readObject(StressChatResources.desktopField).readObject(StressChatResources.productField);
    const variable = product.readNonBlankString(StressChatResources.dataDirectoryVariableField);
    const installed = resolve(this.homeFolder, ...product.readNonBlankString(StressChatResources.dataFolderField).split(StressChatResources.dataFolderSeparator));
    const named = this.environment[variable];
    if (Object.isUndefined(named) || String.isNullOrWhitespace(named))
      return new DataDirectory(join(this.appFolder, ...StressChatResources.developmentDataFolder));
    if (!isAbsolute(named))
      throw new RuntimePartException(StressChatResources.formatRelativeFolder(variable, named));
    if (StressChatCommand.isSameFolder(resolve(named), installed))
      throw new RuntimePartException(StressChatResources.formatInstalledFolder(installed, variable));
    return new DataDirectory(named);
  }

  private static readPairs(commandArguments: readonly string[]): number | null {
    if (commandArguments.length === 0)
      return StressChatResources.defaultPairs;
    const [option, count, ...rest] = commandArguments;
    if (option !== StressChatResources.pairsOption || Object.isUndefined(count) || rest.length > 0 || !StressChatResources.pairsPattern.test(count))
      return null;
    const pairs = Number(count);
    return pairs <= StressChatResources.maximumPairs ? pairs : null;
  }

  private static isSameFolder(first: string, second: string): boolean {
    return first.toLowerCase() === second.toLowerCase();
  }
}
