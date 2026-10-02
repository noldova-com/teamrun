/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

export default class ApiPipe {
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly WINDOWS_ROOT: string = "\\\\.\\pipe\\";
  private static readonly SOCKET_EXTENSION: string = ".sock";
  private static readonly PREFIX: string = "teamrun-api-";
  private static readonly RANDOM_BYTES: number = 6;

  private readonly platform: string;

  public readonly name: string;

  public constructor(platform: string, directory: string) {
    const name = `${ApiPipe.PREFIX}${process.pid}-${randomBytes(ApiPipe.RANDOM_BYTES).toString("hex")}`;

    this.platform = platform;
    this.name = platform === ApiPipe.WINDOWS_PLATFORM ? `${ApiPipe.WINDOWS_ROOT}${name}` : path.join(directory, `${name}${ApiPipe.SOCKET_EXTENSION}`);
  }

  public async removeAsync(): Promise<void> {
    if (this.platform !== ApiPipe.WINDOWS_PLATFORM)
      await rm(this.name, { force: true });
  }
}
