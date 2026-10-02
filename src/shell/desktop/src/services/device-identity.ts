/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader } from "@noldova/teamrun-foundation-json";

import { DeviceIdentityException } from "../exceptions/device-identity.exception.js";
import { Resources } from "../resources.js";

export class DeviceIdentity {
  public static locateFolder(platform: string, environment: NodeJS.ProcessEnv, homeFolder: string): string {
    if (platform === Resources.windowsPlatform)
      return path.join(environment[Resources.localAppDataVariable] ?? path.join(homeFolder, ...Resources.windowsLocalAppData), ...Resources.windowsDeviceFolder);
    if (platform === Resources.macPlatform)
      return path.join(homeFolder, ...Resources.macDeviceFolder);
    const state = environment[Resources.xdgStateVariable];
    return path.join(Object.isUndefined(state) || String.isNullOrWhitespace(state) ? path.join(homeFolder, ...Resources.xdgStateDefault) : state, ...Resources.linuxDeviceFolder);
  }

  public static async readOrCreateAsync(folder: string): Promise<string> {
    const file = path.join(folder, Resources.deviceFileName);
    if (!existsSync(file)) {
      await mkdir(folder, { recursive: true });
      await writeFile(file, `${JSON.stringify({ [Resources.deviceIdField]: randomUUID() })}\n`, { flag: Resources.createOnlyFlag });
    }
    let id: string;
    try {
      id = JsonReader.fromValue(JSON.parse(await readFile(file, Resources.textEncoding))).readString(Resources.deviceIdField);
    }
    catch (error) {
      throw new DeviceIdentityException(Resources.formatInvalidDevice(file), new ExceptionOptions(error));
    }
    if (!Resources.uuidPattern.test(id))
      throw new DeviceIdentityException(Resources.formatInvalidDevice(file));
    return id;
  }
}
