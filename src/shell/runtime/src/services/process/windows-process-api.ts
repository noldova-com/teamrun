/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";

export class WindowsProcessApi implements IWindowsProcessApi {
  public listProcesses(): readonly (readonly [number, number])[] {
    throw new Error("PLACEHOLDER: the Windows binding is not written yet.");
  }

  public openProcess(): bigint | number {
    throw new Error("PLACEHOLDER: the Windows binding is not written yet.");
  }

  public readCreationTime(): bigint | null {
    throw new Error("PLACEHOLDER: the Windows binding is not written yet.");
  }

  public readImagePath(): string | null {
    throw new Error("PLACEHOLDER: the Windows binding is not written yet.");
  }

  public terminateProcess(): boolean {
    throw new Error("PLACEHOLDER: the Windows binding is not written yet.");
  }

  public hasExited(): boolean {
    throw new Error("PLACEHOLDER: the Windows binding is not written yet.");
  }

  public closeHandle(): void {
    throw new Error("PLACEHOLDER: the Windows binding is not written yet.");
  }
}
