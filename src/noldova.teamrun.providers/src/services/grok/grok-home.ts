/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dirname, join } from "node:path";
import "@noldova/context.core";
import type { Provider } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { UsualFolder } from "../usual-folder.js";

export class GrokHome {
  private readonly formerProfileDirectory: string;
  private person: string;

  public readonly directory: string;
  public readonly titleDirectory: string;

  public constructor(environment: NodeJS.ProcessEnv, formerProfileDirectory: string, homeDirectory: string = UsualFolder.home(environment)) {
    this.directory = UsualFolder.of(environment, Resources.grokHomeVariable, Resources.grokDirectoryName, homeDirectory);
    this.titleDirectory = join(dirname(formerProfileDirectory), Resources.grokTitleHomeFolder);
    this.formerProfileDirectory = formerProfileDirectory;
    this.person = this.directory;
  }

  public of(provider: Provider | null, environment: NodeJS.ProcessEnv | null = null): string {
    if (!Object.isNull(environment))
      this.person = UsualFolder.of(environment, Resources.grokHomeVariable, Resources.grokDirectoryName, UsualFolder.home(environment));
    const folder = provider?.profileDir;
    return Object.isNullOrUndefined(folder) || folder === this.formerProfileDirectory ? this.person : folder;
  }

  public isAdded(provider: Provider | null): boolean {
    return this.of(provider) !== this.person;
  }
}
