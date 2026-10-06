/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import path from "node:path";

import type TemporaryFolder from "../processes/temporary-folder.ts";

export default class ApiPipe {
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly WINDOWS_ROOT: string = "\\\\.\\pipe\\";
  private static readonly SOCKET_FOLDER_PREFIX: string = "tr-api-";
  private static readonly SOCKET_NAME: string = "api.sock";
  private static readonly PREFIX: string = "teamrun-api-";
  private static readonly RANDOM_BYTES: number = 6;

  private readonly temporaryFolder: TemporaryFolder;
  private readonly folder: string | null;

  public readonly name: string;

  private constructor(name: string, temporaryFolder: TemporaryFolder, folder: string | null) {
    this.name = name;
    this.temporaryFolder = temporaryFolder;
    this.folder = folder;
  }

  public static async createAsync(platform: string, temporaryFolder: TemporaryFolder): Promise<ApiPipe> {
    if (platform === ApiPipe.WINDOWS_PLATFORM)
      return new ApiPipe(`${ApiPipe.WINDOWS_ROOT}${ApiPipe.PREFIX}${process.pid}-${randomBytes(ApiPipe.RANDOM_BYTES).toString("hex")}`, temporaryFolder, null);

    const folder = await temporaryFolder.createAsync(platform, ApiPipe.SOCKET_FOLDER_PREFIX);
    return new ApiPipe(path.join(folder, ApiPipe.SOCKET_NAME), temporaryFolder, folder);
  }

  public async removeAsync(): Promise<void> {
    if (this.folder !== null)
      await this.temporaryFolder.removeAsync(this.folder);
  }
}
