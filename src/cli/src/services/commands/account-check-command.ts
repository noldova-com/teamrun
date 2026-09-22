/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MethodName, ProviderAccount, ProviderAccountIdParams } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class AccountCheckCommand extends RuntimeCommand {
  public readonly name: string = Resources.accountCheckCommand;
  public readonly description: string = Resources.accountCheckDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const params = new ProviderAccountIdParams(context.commandLine.requirePositional(0, Resources.idArgument));
    const checked = await session.call(MethodName.ProviderAccountCheck, params.toJson());
    output.writeObject(checked, t => this.formatter.formatAccount(ProviderAccount.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
