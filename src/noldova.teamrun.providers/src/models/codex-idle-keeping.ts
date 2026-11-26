/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CodexThreadRelease } from "./codex-thread-release.js";

export class CodexIdleKeeping {
  public readonly ended: Promise<void>;
  public readonly release: CodexThreadRelease;

  public constructor(ended: Promise<void>, release: CodexThreadRelease) {
    this.ended = ended;
    this.release = release;
  }
}
