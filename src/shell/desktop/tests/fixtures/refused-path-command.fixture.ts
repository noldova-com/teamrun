/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PathCommand } from "@noldova/teamrun-shell-desktop";

export class RefusedPathCommand extends PathCommand {
  private readonly refusal: Error;

  public constructor(target: string, link: string, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>, code: string) {
    super(target, link, runProgramAsync);
    this.refusal = Object.assign(new Error(`${code}: the link could not be made`), { code });
  }

  protected override writeLinkAsync(): Promise<void> {
    return Promise.reject(this.refusal);
  }
}
