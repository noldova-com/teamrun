/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MethodName, ProviderListModelsParams } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ModelsCommand extends RuntimeCommand {
  public readonly name: string = Resources.modelsCommand;
  public readonly description: string = Resources.modelsDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const provider = context.commandLine.requirePositional(0, Resources.providerOption);
    const params = new ProviderListModelsParams(provider, context.commandLine.option(Resources.accountOption));
    output.writeStrings(await session.call(MethodName.ProviderListModels, params.toJson()));
    return Resources.exitSuccess;
  }
}
