/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { IProcessStarter } from "@noldova/teamrun-shell-runtime";

import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import { Resources } from "../resources.js";

export class InstallerStart {
  private readonly starter: IProcessStarter;
  private readonly verifyAsync: (installer: string) => Promise<string | null>;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly errorFile: string;

  public constructor(starter: IProcessStarter, verifyAsync: (installer: string) => Promise<string | null>, environment: NodeJS.ProcessEnv, errorFile: string) {
    this.starter = starter;
    this.verifyAsync = verifyAsync;
    this.environment = environment;
    this.errorFile = errorFile;
  }

  public async startAsync(installer: string): Promise<number> {
    const failure = await this.verifyAsync(installer);
    if (!Object.isNull(failure))
      throw new UpdateHandoffException(Resources.formatInstallerUnsigned(installer, failure));
    try {
      return await this.starter.startAsync(installer, Resources.installerArguments, this.environment, this.errorFile);
    }
    catch (error) {
      throw new UpdateHandoffException(Resources.formatInstallerNotStarted(installer, String(error)), new ExceptionOptions(error));
    }
  }
}
