/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";
import type { FileReadResult } from "node:fs/promises";

export interface IOpenedFile {
  stat(): Promise<Pick<Stats, "isFile" | "size" | "mtimeMs">>;
  read(buffer: Buffer, offset: number, length: number, position: number): Promise<Pick<FileReadResult<Buffer>, "bytesRead">>;
}
