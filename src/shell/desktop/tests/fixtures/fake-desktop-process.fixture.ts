/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { Writable } from "node:stream";

import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";

import { FakeProgramHost } from "./fake-program-host.fixture.js";

export class FakeDesktopProcess implements IDesktopProcess {
  private written: string = "";

  public readonly argv: readonly string[];
  public readonly env: NodeJS.ProcessEnv;
  public readonly platform: string;
  public readonly execPath: string = "/electron/electron";
  public readonly homeFolder: string;
  public readonly workingDirectory: string = path.resolve("work");
  public isDefaultApp: boolean = false;
  public isTerminal: boolean = false;
  public readonly errorOutput: Writable = new Writable({
    write: (chunk: Buffer, _encoding, callback): void => {
      this.written += chunk.toString();
      callback();
    }
  });
  public readonly started: (readonly string[])[] = [];
  public readonly relaunched: { readonly command: readonly string[]; readonly environment: NodeJS.ProcessEnv; readonly workingDirectory: string }[] = [];
  public readonly ended: number[] = [];
  public readonly processId: number = 1000;
  public readonly programs: FakeProgramHost = new FakeProgramHost();
  public readonly exceptionListeners: ((error: unknown) => void)[] = [];
  public readonly rejectionListeners: ((reason: unknown) => void)[] = [];
  public endFailure: Error | null = null;
  public startFailure: Error | null = null;
  public relaunchFailure: Error | null = null;

  public constructor(platform: string, argv: readonly string[] = [], env: NodeJS.ProcessEnv = {}, homeFolder: string = "/home/person") {
    this.platform = platform;
    this.argv = argv;
    this.env = env;
    this.homeFolder = homeFolder;
  }

  public get errors(): string {
    return this.written;
  }

  public startDetached(executablePath: string, args: readonly string[], onFailure: (error: Error) => void): void {
    this.started.push([executablePath, ...args]);
    if (!Object.isNull(this.startFailure))
      onFailure(this.startFailure);
  }

  public startDetachedAsync(executablePath: string, args: readonly string[], environment: NodeJS.ProcessEnv, workingDirectory: string): Promise<void> {
    this.relaunched.push({ command: [executablePath, ...args], environment, workingDirectory });
    return Object.isNull(this.relaunchFailure) ? Promise.resolve() : Promise.reject(this.relaunchFailure);
  }

  public endProcess(processId: number): void {
    if (this.endFailure !== null)
      throw this.endFailure;
    this.ended.push(processId);
  }

  public onUncaughtException(listener: (error: unknown) => void): void {
    this.exceptionListeners.push(listener);
  }

  public onUnhandledRejection(listener: (reason: unknown) => void): void {
    this.rejectionListeners.push(listener);
  }
}
