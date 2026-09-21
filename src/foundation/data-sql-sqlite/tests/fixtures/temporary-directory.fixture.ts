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

import { DataSource } from "@noldova/teamrun-foundation-data";

export class TemporaryDirectory implements Disposable {
  public readonly path: string;

  public constructor() {
    this.path = mkdtempSync(join(tmpdir(), "context-sqlite-"));
  }

  public location(name: string): string {
    return join(this.path, name + ".db");
  }

  public dataSource(name: string): DataSource {
    return new DataSource(name, this.location(name));
  }

  public [Symbol.dispose](): void {
    rmSync(this.path, { recursive: true, force: true });
  }
}
