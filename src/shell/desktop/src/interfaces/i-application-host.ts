/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IApplicationHost {
  setName(name: string): void;
  setAppUserModelId(id: string): void;
  requestSingleInstanceLock(): boolean;
  enableSandbox(): void;
  quit(): void;
  whenReady(): Promise<unknown>;
  on(event: "second-instance", listener: () => void): unknown;
  on(event: "window-all-closed", listener: () => void): unknown;
  on(event: "activate", listener: () => void): unknown;
}
