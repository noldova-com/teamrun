/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ITeamRunBridge {
  onCheckpoint(listener: (value: unknown) => void): () => void;
  checkpoint(result: unknown): Promise<boolean>;
  invoke(request: unknown): Promise<unknown>;
  onEvent(listener: (event: unknown) => void): () => void;
  openExternal(url: string): Promise<boolean>;
  pickDirectory(): Promise<string | null>;
  describe(): Promise<unknown>;
  update(command: string): Promise<unknown>;
  onUpdate(listener: (state: unknown) => void): () => void;
  setTitleBar(color: string, symbolColor: string): Promise<boolean>;
  readImage(path: string): Promise<string | null>;
}

declare global {
  interface Window {
    teamrun?: ITeamRunBridge;
  }
}
