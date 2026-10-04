/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class BuildTarget {
  public readonly name: string;
  public readonly runner: string;
  public readonly architecture: string;
  public readonly runsOnPullRequests: boolean;

  public constructor(name: string, runner: string, architecture: string, runsOnPullRequests: boolean) {
    this.name = name;
    this.runner = runner;
    this.architecture = architecture;
    this.runsOnPullRequests = runsOnPullRequests;
  }
}
