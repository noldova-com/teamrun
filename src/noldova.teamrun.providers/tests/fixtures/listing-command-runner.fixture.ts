/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { CommandResult, CommandRunner, NodeProcessStarter, ProcessTerminator, type ProcessCommand } from "@noldova/teamrun.providers";

export class ListingCommandRunner extends CommandRunner {
  private readonly listings: readonly (string | null)[];
  private readonly then: CommandRunner | null;

  public readonly commands: ProcessCommand[] = [];
  public readonly timeouts: number[] = [];
  public readonly outputs: string[] = [];
  public calls: number = 0;

  public constructor(listings: readonly (string | null)[], then: CommandRunner | null = null) {
    super(new NodeProcessStarter(new ProcessTerminator(process.platform)));
    this.listings = listings;
    this.then = then;
  }

  public override run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number): Promise<CommandResult> {
    this.commands.push(command);
    this.timeouts.push(timeoutMilliseconds);
    if (this.calls >= this.listings.length && !Object.isNull(this.then)) {
      this.calls++;
      return this.then.run(command, environment, timeoutMilliseconds).then(t => {
        this.outputs.push(t.stdout);
        return t;
      });
    }
    const listing = this.listings[Math.min(this.calls++, this.listings.length - 1)]!;
    return Object.isNull(listing) ? Promise.reject(new Error("The listing failed.")) : Promise.resolve(new CommandResult(0, null, listing, "", false));
  }
}
