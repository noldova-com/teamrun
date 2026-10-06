/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PathCommand, PathCommandOutcome } from "@noldova/teamrun-shell-desktop";

import { PathCommandFilesFixture } from "./path-command-files.fixture.js";

export class FakePathCommand extends PathCommand {
  public readonly executablePaths: string[] = [];
  public outcome: PathCommandOutcome = PathCommandOutcome.Missing;
  public failure: Error | null = null;

  public constructor() {
    super("/Applications/TeamRun.app/Contents/Resources/bin/teamrun", "/usr/local/bin/teamrun", new PathCommandFilesFixture(), () => Promise.resolve());
  }

  public create(executablePath: string): PathCommand {
    this.executablePaths.push(executablePath);
    return this;
  }

  public override installAsync(): Promise<PathCommandOutcome> {
    return this.failure === null ? Promise.resolve(this.outcome) : Promise.reject(this.failure);
  }
}
