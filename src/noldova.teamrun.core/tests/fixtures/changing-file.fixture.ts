/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";

import type { IOpenedFile } from "@noldova/teamrun.core";

export class ChangingFile implements IOpenedFile, AsyncDisposable {
  private readonly handle: FileHandle;
  private readonly beforeRead: (read: number) => void;
  private reads: number = 0;

  private constructor(handle: FileHandle, beforeRead: (read: number) => void) {
    this.handle = handle;
    this.beforeRead = beforeRead;
  }

  public static async openAsync(path: string, beforeRead: (read: number) => void): Promise<ChangingFile> {
    return new ChangingFile(await open(path, "r"), beforeRead);
  }

  public stat(): Promise<Stats> {
    return this.handle.stat();
  }

  public read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number }> {
    this.beforeRead(this.reads++);
    return this.handle.read(buffer, offset, length, position);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.handle.close();
  }
}
