/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { CommandContribution } from "../models/command-contribution";
import type { DocumentContribution } from "../models/document-contribution";
import type { ViewContribution } from "../models/view-contribution";

export interface IWindowPartContext {
  registerView(view: ViewContribution): void;
  registerDocument(document: DocumentContribution): void;
  registerCommand(command: CommandContribution): void;
  runCommandAsync(name: string, commandArguments?: JsonValue): Promise<JsonValue>;
  openDocument(name: string, instance: string, title: string): void;
  requestAsync(method: string, parameters: JsonValue): Promise<JsonValue>;
  onEvent(event: string, listener: (payload: JsonValue) => void): () => void;
}
