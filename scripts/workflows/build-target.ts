/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type IBuildTargetOptions from "./interfaces/i-build-target-options.ts";
import UiShard from "./ui-shard.ts";

export default class BuildTarget {
  private static readonly WORD_SEPARATOR: string = " ";
  private static readonly KEY_SEPARATOR: string = "-";

  public readonly name: string;
  public readonly runner: string;
  public readonly architecture: string;
  public readonly runsOnPullRequests: boolean;
  public readonly runsSmokeOnPullRequests: boolean;
  public readonly runsUiOnPushes: boolean;
  public readonly uiShardCount: number;
  public readonly splitsTests: boolean;

  public constructor(name: string, runner: string, architecture: string, options: IBuildTargetOptions) {
    this.name = name;
    this.runner = runner;
    this.architecture = architecture;
    this.runsOnPullRequests = options.runsOnPullRequests;
    this.runsSmokeOnPullRequests = options.runsSmokeOnPullRequests;
    this.runsUiOnPushes = options.runsUiOnPushes;
    this.uiShardCount = options.uiShardCount;
    this.splitsTests = options.splitsTests;
  }

  public get key(): string {
    return this.name.toLowerCase().split(BuildTarget.WORD_SEPARATOR).join(BuildTarget.KEY_SEPARATOR);
  }

  public get operatingSystem(): string {
    return this.name.slice(0, this.name.indexOf(BuildTarget.WORD_SEPARATOR));
  }

  public get uiShards(): readonly UiShard[] {
    return Array.from({ length: this.uiShardCount }, (_, i) => new UiShard(this, i + 1, this.uiShardCount));
  }
}
