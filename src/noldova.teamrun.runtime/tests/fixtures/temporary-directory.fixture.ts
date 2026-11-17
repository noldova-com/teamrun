/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class TemporaryDirectory implements Disposable {
  private static readonly PREFIX: string = "teamrun-providers-";

  public readonly path: string;

  public constructor() {
    this.path = mkdtempSync(join(tmpdir(), TemporaryDirectory.PREFIX));
  }

  public resolve(...segments: readonly string[]): string {
    return join(this.path, ...segments);
  }

  public [Symbol.dispose](): void {
    rmSync(this.path, { recursive: true, force: true });
  }
}
