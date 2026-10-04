/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import BuildTarget from "./build-target.ts";
import UiShard from "./ui-shard.ts";

export default class BuildMatrix {
  private static readonly PULL_REQUEST_EVENT: string = "pull_request";
  private static readonly PUSH_EVENT: string = "push";
  private static readonly SMOKE_GREP: string = "@smoke";
  private static readonly TARGETS: readonly BuildTarget[] = [
    new BuildTarget("Linux x64", "ubuntu-24.04", "x64", true, false, true, 2),
    new BuildTarget("Linux ARM64", "ubuntu-24.04-arm", "arm64", true, false, true, 2),
    new BuildTarget("Windows x64", "windows-2025", "x64", true, true, true, 3),
    new BuildTarget("Windows ARM64", "windows-11-arm", "arm64", false, true, true, 3),
    new BuildTarget("macOS x64", "macos-15-intel", "x64", false, true, false, 3),
    new BuildTarget("macOS ARM64", "macos-15", "arm64", true, true, true, 2)
  ];

  private readonly isPullRequest: boolean;

  public readonly targets: readonly BuildTarget[];
  public readonly deferred: readonly BuildTarget[];
  public readonly uiTargets: readonly BuildTarget[];
  public readonly uiDeferred: readonly BuildTarget[];

  public constructor(eventName: string | undefined) {
    this.isPullRequest = eventName === BuildMatrix.PULL_REQUEST_EVENT;
    this.targets = BuildMatrix.TARGETS.filter(t => !this.isPullRequest || t.runsOnPullRequests);
    this.deferred = BuildMatrix.TARGETS.filter(t => !this.targets.includes(t));
    this.uiTargets = this.targets.filter(t => eventName !== BuildMatrix.PUSH_EVENT || t.runsUiOnPushes);
    this.uiDeferred = this.targets.filter(t => !this.uiTargets.includes(t));
  }

  public uiShards(target: BuildTarget): readonly UiShard[] {
    return this.isPullRequest && target.runsSmokeOnPullRequests ? [new UiShard(target, 1, 1, BuildMatrix.SMOKE_GREP)] : target.uiShards;
  }
}
