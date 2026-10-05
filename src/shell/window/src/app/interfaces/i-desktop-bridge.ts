/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";

export interface IDesktopBridge {
  readonly platform: string;
  readonly appearance: unknown;

  notifyReady(appearance: JsonObject): void;
  notifyAppearance(appearance: JsonObject): void;
  onCloseRequest(listener: (requestId: string) => void): () => void;
  answerClose(requestId: string, isSaved: boolean): Promise<boolean>;
  readStartup(): Promise<unknown>;
  onStartup(listener: (state: unknown) => void): () => void;
  actOnStartup(action: string): Promise<boolean>;
  readLayout(): Promise<unknown>;
  writeLayout(layout: JsonObject): Promise<unknown>;
  request(method: string, payload: JsonValue): Promise<unknown>;
  onEvent(listener: (name: string, payload: unknown) => void): () => void;
  readBuild(): Promise<unknown>;
  copyText(text: string): Promise<boolean>;
  openLogFolder(): Promise<boolean>;
  keepAppearance(preferences: JsonObject): void;
  edit(action: string): Promise<boolean>;
  setMenuBar(menuBar: JsonObject): void;
  onMenuCommand(listener: (id: string) => void): () => void;
  onNotificationOpened(listener: (id: string) => void): () => void;
  onQuitQuestion(listener: (question: unknown) => void): () => void;
  answerQuit(choice: string): Promise<boolean>;
  logModule(moduleId: string, message: string): void;
  logError(moduleId: string | null, text: string): void;
}
