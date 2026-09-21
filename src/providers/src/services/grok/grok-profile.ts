/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute, join } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class GrokProfile {
  public readonly directory: string;
  public readonly homeDirectory: string;

  public constructor(directory: string) {
    if (!isAbsolute(directory))
      throw new ArgumentException(Resources.grokProfileAbsolute, Resources.grokProfileParameter);

    this.directory = directory;
    this.homeDirectory = join(directory, Resources.grokHostHomeDirectory);
  }

  public prepare(): void {
    const marker = join(this.directory, Resources.grokProfileMarker);
    if (existsSync(marker)) {
      if (readFileSync(marker, Resources.utf8Encoding) !== Resources.grokProfileMarkerValue)
        throw new Error(Resources.grokProfileNotManaged);
    }
    else {
      if (existsSync(this.directory) && readdirSync(this.directory).length > 0)
        throw new Error(Resources.grokProfileNotManaged);
      mkdirSync(this.directory, { recursive: true });
      writeFileSync(marker, Resources.grokProfileMarkerValue, { flag: "wx", mode: 0o600 });
    }
    mkdirSync(this.homeDirectory, { recursive: true });
    this.writeConfiguration(Resources.grokConfigFile, Resources.grokProfileConfig);
    this.writeConfiguration(Resources.grokRequirementsFile, Resources.grokProfileRequirements);
  }

  private writeConfiguration(name: string, text: string): void {
    const temporary = join(this.directory, `${name}.${randomUUID()}`);
    try {
      writeFileSync(temporary, text, { flag: "wx", mode: 0o600 });
      renameSync(temporary, join(this.directory, name));
    }
    finally {
      rmSync(temporary, { force: true });
    }
  }
}
