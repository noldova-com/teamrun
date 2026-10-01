/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";

import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import type { IFolderProtector } from "../../interfaces/folder-protector.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";

export class WindowsFolderProtector implements IFolderProtector {
  private readonly command: SystemCommand;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(command: SystemCommand, environment: NodeJS.ProcessEnv) {
    this.command = command;
    this.environment = environment;
  }

  public async protectAsync(folder: string): Promise<void> {
    const systemRoot = this.environment[Resources.systemRootVariable];
    if (Object.isUndefined(systemRoot) || String.isNullOrWhitespace(systemRoot))
      throw new SystemCommandException(Resources.systemRootMissing);

    const tools = path.win32.join(systemRoot, Resources.systemFolderName);
    const identity = await this.command.runAsync(path.win32.join(tools, Resources.identityCommandName), Resources.identityArguments);
    const securityIdentifier = Resources.securityIdentifierPattern.exec(identity)?.[1];
    if (Object.isUndefined(securityIdentifier))
      throw new SystemCommandException(Resources.formatIdentityUnreadable(identity));
    await this.command.runAsync(
      path.win32.join(tools, Resources.accessCommandName),
      [folder, Resources.removeInheritanceArgument, Resources.replaceGrantArgument, Resources.formatAccessGrant(securityIdentifier)]);
  }
}
