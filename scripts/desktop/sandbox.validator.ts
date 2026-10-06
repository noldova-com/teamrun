/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, type Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export default class SandboxValidator {
  private static readonly LINUX_PLATFORM: string = "linux";
  private static readonly FILE_NAME: string = "chrome-sandbox";
  private static readonly RESTRICTIONS: readonly (readonly [string, string])[] = [
    ["/proc/sys/kernel/apparmor_restrict_unprivileged_userns", "1"],
    ["/proc/sys/kernel/unprivileged_userns_clone", "0"],
    ["/proc/sys/user/max_user_namespaces", "0"]
  ];
  private static readonly ROOT_USER: number = 0;
  private static readonly REQUIRED_MODE: number = 0o4755;

  private readonly platform: string;
  private readonly readTextAsync: (file: string) => Promise<string | null>;
  private readonly statAsync: (file: string) => Promise<Pick<Stats, "uid" | "mode"> | null>;

  public constructor(
    platform: string,
    readTextAsync: (file: string) => Promise<string | null>,
    statAsync: (file: string) => Promise<Pick<Stats, "uid" | "mode"> | null>) {
    this.platform = platform;
    this.readTextAsync = readTextAsync;
    this.statAsync = statAsync;
  }

  public static async readOptionalTextAsync(file: string): Promise<string | null> {
    return existsSync(file) ? readFile(file, "utf8") : null;
  }

  public static async statOptionalAsync(file: string): Promise<Stats | null> {
    return existsSync(file) ? stat(file) : null;
  }

  public async findProblemAsync(executable: string): Promise<string | null> {
    if (this.platform !== SandboxValidator.LINUX_PLATFORM || !await this.isRestrictedAsync())
      return null;
    const helper = path.join(path.dirname(executable), SandboxValidator.FILE_NAME);
    const status = await this.statAsync(helper);
    if (status === null || status.uid === SandboxValidator.ROOT_USER && (status.mode & SandboxValidator.REQUIRED_MODE) === SandboxValidator.REQUIRED_MODE)
      return null;
    const quoted = `'${helper.replaceAll("'", "'\\''")}'`;
    return [
      "This system restricts unprivileged user namespaces, so Chromium's sandbox needs its helper owned by root with the setuid bit. Set it up once:",
      `  sudo chown root:root ${quoted} && sudo chmod 4755 ${quoted}`,
      "Then run npm start again. Preparing the development app again, after a change to Electron, the version or the icons, needs the step again.",
      ""
    ].join("\n");
  }

  private async isRestrictedAsync(): Promise<boolean> {
    for (const [file, value] of SandboxValidator.RESTRICTIONS)
      if ((await this.readTextAsync(file))?.trim() === value)
        return true;
    return false;
  }
}
