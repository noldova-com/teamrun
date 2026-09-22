/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MethodName, Teammate, TeammateCreateParams, Harness } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class TeammateNewCommand extends RuntimeCommand {
  public readonly name: string = Resources.teammateNewCommand;
  public readonly description: string = Resources.teammateNewDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const name = context.commandLine.requirePositional(0, Resources.teammateNameArgument);
    const account = context.commandLine.requirePositional(1, Resources.accountOption);
    const params = new TeammateCreateParams(name, context.commandLine.option(Resources.roleOption), account, Harness.Provider,
      context.commandLine.option(Resources.modelOption), context.commandLine.option(Resources.effortOption));
    const created = await session.call(MethodName.TeammateCreate, params.toJson());
    output.writeObject(created, t => this.formatter.formatTeammate(Teammate.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
