/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MethodName, ProviderDescriptor } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ProvidersCommand extends RuntimeCommand {
  public readonly name: string = Resources.providersCommand;
  public readonly description: string = Resources.providersDescription;

  protected override async execute(session: RuntimeSession, _context: CommandContext, output: OutputWriter): Promise<number> {
    output.writeObjects(await session.call(MethodName.ProviderList, null), t => this.formatter.formatProvider(ProviderDescriptor.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
