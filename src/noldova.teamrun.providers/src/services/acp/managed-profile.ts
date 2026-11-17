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

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { ProfileFolderException } from "../../exceptions/profile-folder.exception.js";
import { Resources } from "../../resources.js";

export class ManagedProfile {
  private readonly markerValue: string;
  private readonly notManaged: string;

  public readonly directory: string;

  public constructor(directory: string, markerValue: string, notAbsolute: string, notManaged: string) {
    if (!isAbsolute(directory))
      throw new ArgumentException(notAbsolute, Resources.profileDirectoryParameter);

    this.directory = directory;
    this.markerValue = markerValue;
    this.notManaged = notManaged;
  }

  public prepare(): void {
    const marker = join(this.directory, Resources.profileMarker);
    if (existsSync(marker)) {
      if (readFileSync(marker, Resources.utf8Encoding) !== this.markerValue)
        throw new ProfileFolderException(this.notManaged);
    }
    else {
      if (existsSync(this.directory) && readdirSync(this.directory).length > 0)
        throw new ProfileFolderException(this.notManaged);
      mkdirSync(this.directory, { recursive: true });
      writeFileSync(marker, this.markerValue, { flag: "wx", mode: 0o600 });
    }
  }

  public removeFile(segments: readonly string[]): void {
    this.prepare();
    rmSync(join(this.directory, ...segments), { force: true });
  }

  public writeFile(name: string, text: string): void {
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
