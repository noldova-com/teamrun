/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import BuildTarget from "./build-target.ts";

export default class BuildMatrix {
  private static readonly TARGETS: readonly BuildTarget[] = [
    new BuildTarget("Linux x64", "ubuntu-24.04", "x64", true, 2),
    new BuildTarget("Linux ARM64", "ubuntu-24.04-arm", "arm64", true, 2),
    new BuildTarget("Windows x64", "windows-2025", "x64", true, 3),
    new BuildTarget("Windows ARM64", "windows-11-arm", "arm64", false, 3),
    new BuildTarget("macOS x64", "macos-15-intel", "x64", false, 3),
    new BuildTarget("macOS ARM64", "macos-15", "arm64", true, 2)
  ];

  public readonly targets: readonly BuildTarget[];
  public readonly deferred: readonly BuildTarget[];

  public constructor(isPullRequest: boolean) {
    this.targets = BuildMatrix.TARGETS.filter(t => !isPullRequest || t.runsOnPullRequests);
    this.deferred = BuildMatrix.TARGETS.filter(t => !this.targets.includes(t));
  }
}
