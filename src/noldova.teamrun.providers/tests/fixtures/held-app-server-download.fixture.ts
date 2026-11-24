/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { CodexAppServerDownload, CommandRunner, NodeProcessStarter, ProcessTerminator } from "@noldova/teamrun.providers";

export class HeldAppServerDownload extends CodexAppServerDownload {
  public readonly fetched: string[] = [];
  public readonly signals: AbortSignal[] = [];
  public program: string | null = null;

  public constructor() {
    super("held", "held", null, process.platform, null, new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))), 1);
  }

  public override programOf(): string | null {
    return this.program;
  }

  public override fetch(version: string, signal: AbortSignal): Promise<string | null> {
    this.fetched.push(version);
    this.signals.push(signal);
    return Promise.resolve(null);
  }
}
