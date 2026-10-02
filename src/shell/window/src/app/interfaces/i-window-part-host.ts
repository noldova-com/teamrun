/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

export interface IWindowPartHost {
  requestAsync(method: string, payload: JsonValue): Promise<JsonValue>;

  onEvent(listener: (name: string, payload: JsonValue) => void): () => void;

  openDocument(moduleId: string, name: string, instance: string, title: string): void;

  isCommandRegistered(name: string): boolean;

  runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue>;

  refresh(): void;
}
