/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import "@noldova/teamrun-foundation-core";

import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";

/**
 * Keeps the window's state in a JSON file (`window.json` in the data directory): the default when
 * the file is missing or unreadable, and nothing thrown when it cannot be written.
 */
export class WindowStateStore {
  public readonly path: string;

  public constructor(path: string) {
    this.path = path;
  }

  public read(): WindowState {
    if (!existsSync(this.path))
      return WindowState.createDefault();
    try {
      return WindowState.fromJson(JSON.parse(readFileSync(this.path, Resources.utf8Encoding)));
    }
    catch {
      return WindowState.createDefault();
    }
  }

  public write(state: WindowState): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path, JSON.stringify(state.toJson()));
    }
    catch {
      // The window still works; its place is only not remembered.
    }
  }
}
