/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import BuildTarget from "./build-target.ts";
import GitHubEvent from "./github-event.ts";
import UiShard from "./ui-shard.ts";

export default class BuildMatrix {
  public static readonly TARGETS: readonly BuildTarget[] = [
    new BuildTarget("Linux x64", "ubuntu-24.04", "x64", { runsOnPullRequests: true, runsOnPushes: true, runsSmokeOnPullRequests: false, uiShardCount: 5, splitsTests: true }),
    new BuildTarget("Linux ARM64", "ubuntu-24.04-arm", "arm64", { runsOnPullRequests: true, runsOnPushes: true, runsSmokeOnPullRequests: false, uiShardCount: 5, splitsTests: true }),
    new BuildTarget("Windows x64", "windows-2025", "x64", { runsOnPullRequests: true, runsOnPushes: true, runsSmokeOnPullRequests: true, uiShardCount: 3, splitsTests: true }),
    new BuildTarget("Windows ARM64", "windows-11-arm", "arm64", { runsOnPullRequests: false, runsOnPushes: true, runsSmokeOnPullRequests: true, uiShardCount: 3, splitsTests: true }),
    new BuildTarget("macOS x64", "macos-15-intel", "x64", { runsOnPullRequests: false, runsOnPushes: false, runsSmokeOnPullRequests: true, uiShardCount: 3, splitsTests: false }),
    new BuildTarget("macOS ARM64", "macos-15", "arm64", { runsOnPullRequests: true, runsOnPushes: true, runsSmokeOnPullRequests: true, uiShardCount: 2, splitsTests: false })
  ];

  private static readonly SMOKE_GREP: string = "@smoke";

  private readonly isPullRequest: boolean;

  public readonly targets: readonly BuildTarget[];
  public readonly deferred: readonly BuildTarget[];

  public constructor(eventName: string | undefined) {
    this.isPullRequest = eventName !== undefined && GitHubEvent.PULL_REQUEST_LEVEL.includes(eventName);
    this.targets = BuildMatrix.TARGETS.filter(t => this.isPullRequest ? t.runsOnPullRequests : eventName !== GitHubEvent.PUSH || t.runsOnPushes);
    this.deferred = BuildMatrix.TARGETS.filter(t => !this.targets.includes(t));
  }

  public uiShards(target: BuildTarget): readonly UiShard[] {
    return this.isPullRequest && target.runsSmokeOnPullRequests ? [new UiShard(target, 1, 1, BuildMatrix.SMOKE_GREP)] : target.uiShards;
  }

  public foldsUi(target: BuildTarget): boolean {
    const shards = this.uiShards(target);
    return !target.splitsTests && shards.length === 1 && shards.every(t => !t.isPrebuilt);
  }
}
