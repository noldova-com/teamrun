/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, fstatSync, openSync, readSync } from "node:fs";

import "@noldova/context.core";

import { Resources } from "../resources.js";
import { CommandOutputDecoder } from "./command-output-decoder.js";

export class TaskOutputReader {
  public static readTail(path: string, maximumBytes: number = Resources.maximumTaskOutputBytes): string {
    let descriptor: number | null = null;
    try {
      descriptor = openSync(path, Resources.readFlag);
      const size = fstatSync(descriptor).size;
      const length = Math.min(size, maximumBytes);
      const buffer = Buffer.alloc(length);
      readSync(descriptor, buffer, 0, length, size - length);
      const text = buffer.toString(Resources.utf8Encoding);
      return CommandOutputDecoder.decode(length < size ? text.replace(Resources.leadingReplacementPattern, String.empty) : text);
    }
    catch {
      return String.empty;
    }
    finally {
      if (!Object.isNull(descriptor))
        closeSync(descriptor);
    }
  }
}
