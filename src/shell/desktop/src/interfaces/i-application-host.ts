/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDockHost } from "./i-dock-host.js";
import type { IPreventableEvent } from "./i-preventable-event.js";

export interface IApplicationHost {
  readonly isPackaged: boolean;
  readonly dock: IDockHost | undefined;

  setName(name: string): void;
  setAppUserModelId(id: string): void;
  setDesktopName(name: string): void;
  setPath(name: "userData", path: string): void;
  requestSingleInstanceLock(): boolean;
  getPreferredSystemLanguages(): string[];
  isInApplicationsFolder(): boolean;
  enableSandbox(): void;
  quit(): void;
  relaunch(): void;
  exit(exitCode: number): void;
  whenReady(): Promise<unknown>;
  on(event: "second-instance", listener: () => void): unknown;
  on(event: "window-all-closed", listener: () => void): unknown;
  on(event: "activate", listener: () => void): unknown;
  on(event: "will-quit", listener: () => void): unknown;
  on(event: "before-quit", listener: (event: IPreventableEvent) => void): unknown;
}
