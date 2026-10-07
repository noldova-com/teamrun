/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";
import { type IProcessStarter, LaunchException } from "@noldova/teamrun-shell-runtime";

import type { IUtilityProcessHost } from "../interfaces/i-utility-process-host.js";
import { DetachedStartReply } from "../models/detached-start-reply.js";
import { DetachedStartRequest } from "../models/detached-start-request.js";
import { Resources } from "../resources.js";

export class UtilityProcessStarter implements IProcessStarter {
  private readonly host: IUtilityProcessHost;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly workingDirectory: string | null;
  private readonly entryPath: string;

  public constructor(host: IUtilityProcessHost, environment: NodeJS.ProcessEnv, workingDirectory: string | null = null, entryPath: string = UtilityProcessStarter.entryPath) {
    this.host = host;
    this.environment = environment;
    this.workingDirectory = workingDirectory;
    this.entryPath = entryPath;
  }

  public static get entryPath(): string {
    return fileURLToPath(new URL(Resources.utilityEntryRelativePath, import.meta.url));
  }

  public startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
    const request = new DetachedStartRequest(executable, launchArguments, errorFile, environment);
    const starter = this.host.fork(this.entryPath, [], {
      stdio: Resources.ignoredStdio,
      serviceName: Resources.starterServiceName,
      env: { ...this.environment, [Resources.noConsoleVariable]: Resources.noConsoleValue },
      ...(Object.isNull(this.workingDirectory) ? {} : { cwd: this.workingDirectory })
    });
    return new Promise<number>((resolve, reject) => {
      starter.once(Resources.messageEvent, (message: unknown) => {
        starter.postMessage(Resources.starterAcknowledgement);
        Promise.try(() => DetachedStartReply.fromJson(message).requireProcessId()).then(resolve, reject);
      });
      starter.once(Resources.exitEvent, () => reject(new LaunchException(Resources.starterEnded)));
      starter.postMessage(request.toJson());
    });
  }
}
