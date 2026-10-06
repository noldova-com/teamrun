/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";

import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import type { IFolderProtector } from "../../interfaces/i-folder-protector.js";
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

    const owners = securityIdentifier.endsWith(Resources.administratorSuffix)
      ? [securityIdentifier, Resources.administratorAlias]
      : [securityIdentifier];
    const accessCommand = path.win32.join(tools, Resources.accessCommandName);
    await this.command.runAsync(accessCommand, [folder, Resources.resetAccessArgument]);
    await this.command.runAsync(
      accessCommand,
      [folder, Resources.removeInheritanceArgument, Resources.replaceGrantArgument, Resources.formatAccessGrant(securityIdentifier)]);

    const access = await this.readAccessAsync(accessCommand, folder);
    const trustees = WindowsFolderProtector.readTrustees(access);
    if (!Resources.protectedAccessPattern.test(access) || trustees.length === 0 || trustees.some(t => !owners.includes(t)))
      throw new SystemCommandException(Resources.formatFolderNotPrivate(folder, access.trim()));
  }

  private static readTrustees(access: string): readonly string[] {
    return [...access.matchAll(Resources.accessEntryPattern)].map(t => String(t[1]));
  }

  private async readAccessAsync(accessCommand: string, folder: string): Promise<string> {
    const file = path.join(folder, Resources.formatTemporaryName(Resources.accessFileName, randomUUID()));
    try {
      await this.command.runAsync(accessCommand, [folder, Resources.saveAccessArgument, file]);
      return await readFile(file, Resources.accessFileEncoding);
    }
    finally {
      await rm(file, { force: true });
    }
  }
}
