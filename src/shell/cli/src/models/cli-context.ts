/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";
import path from "node:path";
import type { Readable, Writable } from "node:stream";

import type { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { ChildProcessStarter, type IProcessStarter } from "@noldova/teamrun-shell-runtime";

import type { IDesktopOpener } from "../interfaces/i-desktop-opener.js";
import { Resources } from "../resources.js";
import { DesktopOpener } from "../services/desktop-opener.js";

export class CliContext {
  public readonly environment: NodeJS.ProcessEnv;
  public readonly platform: string;
  public readonly homeFolder: string;
  public readonly executablePath: string;
  public readonly runtimeEntryPath: string;
  public readonly identity: BuildIdentity;
  public readonly output: Writable;
  public readonly error: Writable;
  public readonly input: Readable;
  public readonly signals: EventEmitter;
  public readonly runtimeStarter: IProcessStarter;
  public readonly desktopOpener: IDesktopOpener;
  public readonly processId: number;
  public readonly updateWaitMilliseconds: number;
  public readonly declarationsFile: string;

  public constructor(
    environment: NodeJS.ProcessEnv,
    platform: string,
    homeFolder: string,
    executablePath: string,
    runtimeEntryPath: string,
    identity: BuildIdentity,
    output: Writable,
    error: Writable,
    input: Readable,
    signals: EventEmitter,
    runtimeStarter: IProcessStarter = new ChildProcessStarter(),
    desktopOpener: IDesktopOpener = new DesktopOpener(),
    processId: number = process.pid,
    updateWaitMilliseconds: number = Resources.updateWait,
    declarationsFile: string = path.join(path.dirname(runtimeEntryPath), ...Resources.declarationsSegments)) {
    this.environment = environment;
    this.platform = platform;
    this.homeFolder = homeFolder;
    this.executablePath = executablePath;
    this.runtimeEntryPath = runtimeEntryPath;
    this.identity = identity;
    this.output = output;
    this.error = error;
    this.input = input;
    this.signals = signals;
    this.runtimeStarter = runtimeStarter;
    this.desktopOpener = desktopOpener;
    this.processId = processId;
    this.updateWaitMilliseconds = updateWaitMilliseconds;
    this.declarationsFile = declarationsFile;
  }
}
