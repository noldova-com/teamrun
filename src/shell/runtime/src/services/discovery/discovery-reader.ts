/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { DiscoveryFormatException } from "../../exceptions/discovery-format.exception.js";
import { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";

export class DiscoveryReader {
  public static async readAsync(dataDirectory: DataDirectory): Promise<RuntimeDiscovery | null> {
    const file = dataDirectory.discoveryFile;
    if (!existsSync(file))
      return null;

    const text = await readFile(file, Resources.utf8Encoding);
    try {
      return RuntimeDiscovery.fromJson(JSON.parse(text));
    }
    catch (error) {
      throw new DiscoveryFormatException(Resources.formatDiscoveryUnreadable(file, String(error)), new ExceptionOptions(error));
    }
  }
}
