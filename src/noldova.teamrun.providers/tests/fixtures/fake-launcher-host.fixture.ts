/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";

import type { ISharedMcpLauncherHost } from "@noldova/teamrun.providers";

export class FakeLauncherHost extends EventEmitter implements ISharedMcpLauncherHost {
  public readonly stdin: PassThrough = new PassThrough();
  public readonly stderr: Writable = new Writable({
    write: (chunk: Buffer, _encoding, done) => {
      this.errors += chunk.toString();
      done();
    }
  });
  public readonly codes: number[] = [];
  public pid: number = 5555;
  public ppid: number = 6666;
  public readonly signals: [number, NodeJS.Signals][] = [];
  public refusing: boolean = false;
  public errors: string = "";

  public exit(code: number): void {
    this.codes.push(code);
  }

  public kill(processId: number, signal: NodeJS.Signals): void {
    this.signals.push([processId, signal]);
    if (this.refusing)
      throw new Error("No such process.");
  }
}
