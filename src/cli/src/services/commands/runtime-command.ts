/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICommand } from "../../interfaces/i-command.js";
import type { CommandContext } from "../../models/command-context.js";
import { EntityFormatter } from "../entity-formatter.js";
import { OutputWriter } from "../output-writer.js";
import { RuntimeSession } from "../runtime-session.js";

export abstract class RuntimeCommand implements ICommand {
  public abstract readonly name: string;
  public abstract readonly description: string;
  protected readonly formatter: EntityFormatter = new EntityFormatter();

  public async run(context: CommandContext): Promise<number> {
    const session = await RuntimeSession.open(context.connections);
    try {
      return await this.execute(session, context, new OutputWriter(context.console, context.settings.isJson));
    }
    finally {
      session[Symbol.dispose]();
    }
  }

  protected abstract execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number>;
}
