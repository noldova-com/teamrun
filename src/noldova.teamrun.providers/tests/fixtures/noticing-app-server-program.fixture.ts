/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { CodexAppServerProgram, CommandRunner, NodeProcessStarter, type ProcessCommand, ProcessTerminator } from "@noldova/teamrun.providers";

import { HeldAppServerDownload } from "./held-app-server-download.fixture.js";
import { StampedVersionReader } from "./stamped-version-reader.fixture.js";

export class NoticingAppServerProgram extends CodexAppServerProgram {
  public static readonly NOTICE: string = "Codex chats show in the Codex app.";

  public readonly reads: string[] = [];
  public readonly environments: NodeJS.ProcessEnv[] = [];

  public constructor() {
    super(new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))), new StampedVersionReader(), new HeldAppServerDownload(), 1);
  }

  public override readNotice(command: ProcessCommand, environment: NodeJS.ProcessEnv, downloads: boolean): Promise<string | null> {
    this.reads.push(`${command.executable} ${downloads ? "downloads" : "reads"}`);
    this.environments.push(environment);
    return Promise.resolve(NoticingAppServerProgram.NOTICE);
  }
}
