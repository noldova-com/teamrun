/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

export default class ApiPipe {
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly WINDOWS_ROOT: string = "\\\\.\\pipe\\";
  private static readonly SOCKET_ROOT: string = "/tmp";
  private static readonly SOCKET_FOLDER_PREFIX: string = "tr-api-";
  private static readonly SOCKET_NAME: string = "api.sock";
  private static readonly PREFIX: string = "teamrun-api-";
  private static readonly RANDOM_BYTES: number = 6;

  private readonly folder: string | null;

  public readonly name: string;

  private constructor(name: string, folder: string | null) {
    this.name = name;
    this.folder = folder;
  }

  public static async createAsync(platform: string, root: string = ApiPipe.SOCKET_ROOT): Promise<ApiPipe> {
    if (platform === ApiPipe.WINDOWS_PLATFORM)
      return new ApiPipe(`${ApiPipe.WINDOWS_ROOT}${ApiPipe.PREFIX}${process.pid}-${randomBytes(ApiPipe.RANDOM_BYTES).toString("hex")}`, null);

    const folder = await mkdtemp(path.join(root, ApiPipe.SOCKET_FOLDER_PREFIX));
    return new ApiPipe(path.join(folder, ApiPipe.SOCKET_NAME), folder);
  }

  public async removeAsync(): Promise<void> {
    if (this.folder !== null)
      await rm(this.folder, { recursive: true, force: true });
  }
}
