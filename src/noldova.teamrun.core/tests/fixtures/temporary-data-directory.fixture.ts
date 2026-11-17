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

export class TemporaryDataDirectory implements Disposable {
  private static readonly PREFIX: string = "teamrun-test-";

  public readonly path: string;

  public constructor() {
    this.path = mkdtempSync(join(tmpdir(), TemporaryDataDirectory.PREFIX));
  }

  public [Symbol.dispose](): void {
    rmSync(this.path, { recursive: true, force: true });
  }
}
