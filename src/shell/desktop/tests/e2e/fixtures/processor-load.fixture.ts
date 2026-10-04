/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import os from "node:os";

interface ProcessorTimes {
  readonly busy: number;
  readonly total: number;
}

export default class ProcessorLoadFixture {
  private static readonly INTERVAL: number = 1_000;

  private readonly percentages: number[] = [];
  private last: ProcessorTimes = ProcessorLoadFixture.read();
  private lastTime: number = Date.now();

  public sample(): void {
    if (Date.now() - this.lastTime < ProcessorLoadFixture.INTERVAL)
      return;
    const times = ProcessorLoadFixture.read();
    const total = times.total - this.last.total;
    this.percentages.push(total === 0 ? 0 : Math.round(100 * (times.busy - this.last.busy) / total));
    this.last = times;
    this.lastTime = Date.now();
  }

  public describe(): string {
    const use = this.percentages.length === 0 ? "not sampled" : `${this.percentages.join(", ")} %`;
    return `${os.cpus().length} processors, busy each second: ${use}`;
  }

  private static read(): ProcessorTimes {
    let busy = 0;
    let total = 0;
    for (const { times } of os.cpus()) {
      busy += times.user + times.nice + times.sys + times.irq;
      total += times.user + times.nice + times.sys + times.irq + times.idle;
    }
    return { busy, total };
  }
}
