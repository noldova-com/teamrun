/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { resolve } from "node:path";

import { MethodName, ProviderAccount, ProviderAccountCreateParams } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class AccountAddCommand extends RuntimeCommand {
  public readonly name: string = Resources.accountAddCommand;
  public readonly description: string = Resources.accountAddDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const provider = context.commandLine.requirePositional(0, Resources.providerOption);
    const label = context.commandLine.requirePositional(1, Resources.labelArgument);
    const profileDir = resolve(context.commandLine.requirePositional(2, Resources.profileDirArgument));
    const params = new ProviderAccountCreateParams(provider, label, profileDir);
    const created = await session.call(MethodName.ProviderAccountCreate, params.toJson());
    output.writeObject(created, t => this.formatter.formatAccount(ProviderAccount.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
