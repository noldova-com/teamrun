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

export class FakeDesktopProcess implements IDesktopProcess {
  private written: string = "";

  public readonly argv: readonly string[];
  public readonly env: NodeJS.ProcessEnv;
  public readonly platform: string;
  public readonly execPath: string = "/electron/electron";
  public readonly homeFolder: string;
  public readonly workingDirectory: string = path.resolve("work");
  public readonly errorOutput: Writable = new Writable({
    write: (chunk: Buffer, _encoding, callback): void => {
      this.written += chunk.toString();
      callback();
    }
  });
  public readonly started: string[] = [];
  public readonly ended: number[] = [];
  public endFailure: Error | null = null;

  public constructor(platform: string, argv: readonly string[] = [], env: NodeJS.ProcessEnv = {}, homeFolder: string = "/home/person") {
    this.platform = platform;
    this.argv = argv;
    this.env = env;
    this.homeFolder = homeFolder;
  }

  public get errors(): string {
    return this.written;
  }

  public startDetached(executablePath: string): void {
    this.started.push(executablePath);
  }

  public endProcess(processId: number): void {
    if (this.endFailure !== null)
      throw this.endFailure;
    this.ended.push(processId);
  }
}
