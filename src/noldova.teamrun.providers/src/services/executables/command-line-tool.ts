/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { IProviderTool } from "@noldova/teamrun.core";
import { ProviderTool } from "@noldova/teamrun.protocol";

import type { LocatedExecutable } from "../../models/located-executable.js";
import { Resources } from "../../resources.js";
import type { ExecutableVersionReader } from "./executable-version.reader.js";

export class CommandLineTool implements IProviderTool {
  private readonly kind: string;
  private readonly locate: () => LocatedExecutable | null;
  private readonly versionReader: ExecutableVersionReader;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly installCommand: string | null;
  private readonly subscribeUrl: string | null;

  public constructor(kind: string, locate: () => LocatedExecutable | null, versionReader: ExecutableVersionReader, environment: NodeJS.ProcessEnv,
    installCommand: string | null, subscribeUrl: string | null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindParameterName);

    this.kind = kind;
    this.locate = locate;
    this.versionReader = versionReader;
    this.environment = environment;
    this.installCommand = installCommand;
    this.subscribeUrl = subscribeUrl;
  }

  public async check(): Promise<ProviderTool> {
    const located = this.locate();
    const version = Object.isNull(located) ? null : await this.versionReader.read(located.toCommand(), this.environment);
    return new ProviderTool(this.kind, !Object.isNull(located), version, this.installCommand, this.subscribeUrl);
  }

  public static installCommandFor(platform: string, posixCommand: string, windowsCommand: string | null): string | null {
    return platform === Resources.windowsPlatform ? windowsCommand : posixCommand;
  }
}
