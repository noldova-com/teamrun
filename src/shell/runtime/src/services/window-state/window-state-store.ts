/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";
import type { WindowStateKey } from "@noldova/teamrun-shell-protocol";

import type { WindowStateKind } from "../../enums/window-state-kind.js";
import { Resources } from "../../resources.js";
import type { ShellDatabase } from "../database/shell-database.js";

export class WindowStateStore {
  private readonly database: ShellDatabase;

  public constructor(database: ShellDatabase) {
    this.database = database;
  }

  public read(kind: WindowStateKind, key: WindowStateKey): JsonObject | null {
    const text = this.database.read(Resources.formatReadWindowState(kind), key.device, key.window)?.[Resources.valueColumn];
    return Object.isString(text) ? JsonReader.fromValue(JSON.parse(text)).toJson() : null;
  }

  public write(kind: WindowStateKind, key: WindowStateKey, value: JsonObject): void {
    this.database.run(Resources.formatWriteWindowState(kind), key.device, key.window, JSON.stringify(value));
  }
}
