/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { MethodName, Project, ProjectOpenParams } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class OpenFolderCommand extends TeamRunCommand {
  public readonly name: string = Resources.openFolderCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const params = new ProjectOpenParams(values.readFolder(Resources.folderValue));
    const project = Project.fromJson(await this.client.requestAsync(MethodName.ProjectOpen, params.toJson(), signal));
    return new CliCommandResult(project.toJson(), Resources.formatProjectOpened(project));
  }
}
