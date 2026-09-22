/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { OutputFormat } from "../enums/output-format.js";
import type { CommandLine } from "./command-line.js";
import { Resources } from "../resources.js";

export class CliSettings {
  public readonly dataDirectory: string;
  public readonly format: OutputFormat;
  public readonly idleGraceMilliseconds: number;
  public readonly runtimeProviders: string | null;
  public readonly productVersion: string;

  public constructor(dataDirectory: string, format: OutputFormat, idleGraceMilliseconds: number, runtimeProviders: string | null, productVersion: string) {
    ArgumentException.throwIfNullOrWhitespace(dataDirectory, Resources.dataDirectoryOption);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersion);

    this.dataDirectory = dataDirectory;
    this.format = format;
    this.idleGraceMilliseconds = idleGraceMilliseconds;
    this.runtimeProviders = runtimeProviders;
    this.productVersion = productVersion;
  }

  public static fromCommandLine(commandLine: CommandLine, homeDirectory: string = homedir()): CliSettings {
    const dataDirectory = resolve(commandLine.option(Resources.dataDirectoryOption) ?? join(homeDirectory, ...Resources.dataDirectorySegments));
    const format = commandLine.hasFlag(Resources.jsonOption) ? OutputFormat.Json : OutputFormat.Text;
    const idleGrace = commandLine.option(Resources.idleGraceOption);

    return new CliSettings(
      dataDirectory,
      format,
      Object.isNull(idleGrace) ? Resources.defaultIdleGrace : Number(idleGrace),
      commandLine.option(Resources.runtimeProvidersOption),
      Resources.productVersion);
  }

  public get isJson(): boolean {
    return this.format === OutputFormat.Json;
  }

  public get runtimeArguments(): readonly string[] {
    return Object.isNull(this.runtimeProviders) ? [] : [Resources.runtimeProvidersArgument, this.runtimeProviders];
  }
}
