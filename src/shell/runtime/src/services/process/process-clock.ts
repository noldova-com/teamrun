/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { uptime } from "node:os";

import { Resources } from "../../resources.js";

export class ProcessClock {
  private readonly isBootRelative: boolean;

  public readonly boot: string;

  public constructor(boot: string, isBootRelative: boolean) {
    this.boot = boot;
    this.isBootRelative = isBootRelative;
  }

  public static create(platform: string, bootIdFile: string = Resources.bootIdFile): ProcessClock {
    return platform === Resources.linuxPlatform
      ? new ProcessClock(readFileSync(bootIdFile, "utf8").trim(), true)
      : new ProcessClock(String(Math.round(Date.now() / 1000 - uptime())), false);
  }

  public now(): number {
    return this.isBootRelative ? Math.round(uptime() * 1000) : Date.now();
  }

  public isSameBoot(boot: string): boolean {
    return this.isBootRelative
      ? boot === this.boot
      : Math.abs(Number(boot) - Number(this.boot)) <= Resources.bootToleranceSeconds;
  }
}
