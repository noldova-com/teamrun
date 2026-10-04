/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

import "@noldova/teamrun-foundation-core";

import { ProcessStartException } from "../../exceptions/process-start.exception.js";
import { Resources } from "../../resources.js";
import type { ProcessEnvironment } from "./process-environment.js";

export class ProgramLocator {
  private readonly isWindows: boolean;

  public constructor(platform: string) {
    this.isWindows = platform === Resources.windowsPlatform;
  }

  public locate(program: string, environment: ProcessEnvironment): string {
    const folders = this.isAbsolute(program) ? [path.dirname(program)] : this.listFolders(program, environment);
    const candidates = this.listCandidates(path.basename(program), environment);
    for (const folder of folders) {
      const file = candidates.map(t => path.join(folder, t)).find(t => this.isProgram(t));
      if (!Object.isUndefined(file))
        return file;
    }
    throw new ProcessStartException(Resources.formatProgramNotFound(program));
  }

  public isBatch(file: string): boolean {
    return this.isWindows && Resources.batchExtensions.includes(path.extname(file).toLowerCase());
  }

  private isAbsolute(file: string): boolean {
    return path.isAbsolute(file) && path.parse(path.resolve(file)).root.toLowerCase() === path.parse(path.normalize(file)).root.toLowerCase();
  }

  private listFolders(program: string, environment: ProcessEnvironment): readonly string[] {
    if ((this.isWindows ? Resources.windowsNamePattern : Resources.pathSeparatorPattern).test(program))
      throw new ProcessStartException(Resources.formatProgramPathRelative(program));
    const delimiter = this.isWindows ? Resources.windowsPathDelimiter : Resources.posixPathDelimiter;
    return (environment.read(Resources.pathVariable) ?? String.empty).split(delimiter).filter(t => this.isAbsolute(t));
  }

  private listCandidates(name: string, environment: ProcessEnvironment): readonly string[] {
    if (!this.isWindows)
      return [name];
    const configured = environment.read(Resources.programExtensionsVariable);
    const named = (Object.isUndefined(configured) || String.isNullOrWhitespace(configured) ? Resources.defaultProgramExtensions : configured)
      .split(Resources.windowsPathDelimiter)
      .map(t => t.trim().toLowerCase())
      .filter(t => Resources.programExtensions.includes(t))
      .map(t => `${name}${t}`);
    return Resources.programExtensions.includes(path.extname(name).toLowerCase()) ? [name, ...named] : named;
  }

  private isProgram(file: string): boolean {
    try {
      if (!statSync(file).isFile())
        return false;
      if (!this.isWindows)
        accessSync(file, constants.X_OK);
      return true;
    }
    catch {
      return false;
    }
  }
}
