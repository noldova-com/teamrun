/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";

export interface IPathCommandFiles {
  lstat(file: string): Promise<Stats>;
  readlink(link: string): Promise<string>;
  rm(file: string): Promise<void>;
  mkdir(folder: string, options: { readonly recursive: true }): Promise<string | undefined>;
  symlink(target: string, link: string): Promise<void>;
}
