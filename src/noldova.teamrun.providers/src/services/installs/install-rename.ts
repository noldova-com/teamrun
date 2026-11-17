/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ITimer, NodeTimer } from "@noldova/teamrun.core";

import { InstallHeldException } from "../../exceptions/install-held.exception.js";
import { Resources } from "../../resources.js";

export class InstallRename {
  private readonly platform: string;
  private readonly rename: (from: string, to: string) => void;
  private readonly timer: ITimer;

  public constructor(platform: string, rename: (from: string, to: string) => void, timer: ITimer = new NodeTimer()) {
    this.platform = platform;
    this.rename = rename;
    this.timer = timer;
  }

  public async moveAsync(from: string, to: string): Promise<void> {
    let waited = 0;
    for (let delay = Resources.renameRetryFirstDelay; ; delay = Math.min(delay * 2, Resources.renameRetryLongestDelay)) {
      try {
        this.rename(from, to);
        return;
      }
      catch (error) {
        if (!this.retries(error))
          throw error;
        if (waited + delay > Resources.renameRetryLimit)
          throw new InstallHeldException(error.message, InstallRename.codeOf(error), error);
      }
      await this.timer.delayAsync(delay, new AbortController().signal);
      waited += delay;
    }
  }

  public static codeOf(error: unknown): string {
    return error instanceof Error && "code" in error ? String(error.code) : String.empty;
  }

  private retries(error: unknown): error is Error {
    return this.platform === Resources.windowsPlatform && Resources.renameRetryCodes.includes(InstallRename.codeOf(error));
  }
}
