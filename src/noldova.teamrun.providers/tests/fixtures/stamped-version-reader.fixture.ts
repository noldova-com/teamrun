/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandRunner, ExecutableVersionReader, type ProcessCommand } from "@noldova/teamrun.providers";

import { CountWaiter } from "./count-waiter.fixture.js";
import { WatchingProcessStarter } from "./watching-process-starter.fixture.js";

export class StampedVersionReader extends ExecutableVersionReader {
  private readonly starter: WatchingProcessStarter;
  private readonly ending: CountWaiter = new CountWaiter();

  public stamp: string | null = "1";
  public ended: number = 0;

  public constructor(starter: WatchingProcessStarter = new WatchingProcessStarter(() => undefined)) {
    super(new CommandRunner(starter), 5000);
    this.starter = starter;
  }

  public get reads(): number {
    return this.starter.started.length;
  }

  public override async read(command: ProcessCommand, environment: NodeJS.ProcessEnv, cancel: AbortSignal | null = null): Promise<string | null> {
    try {
      return await super.read(command, environment, cancel);
    }
    finally {
      this.ended += 1;
      this.ending.add();
    }
  }

  public endedAt(count: number): Promise<void> {
    return this.ending.reach(count);
  }

  public override readStamp(): string | null {
    return this.stamp;
  }
}
