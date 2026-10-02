/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartLoader } from "@noldova/teamrun-shell-runtime";

export class RuntimePartLoaderFixture implements IRuntimePartLoader {
  private readonly parts: ReadonlyMap<string, IRuntimePart | Error>;

  public readonly loaded: string[] = [];

  public constructor(parts: ReadonlyMap<string, IRuntimePart | Error>) {
    this.parts = parts;
  }

  public async loadAsync(packageName: string): Promise<IRuntimePart> {
    this.loaded.push(packageName);
    const part = this.parts.get(packageName) ?? new Error(`${packageName} is not installed.`);
    if (part instanceof Error)
      throw part;
    return part;
  }
}
