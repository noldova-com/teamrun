/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export default class SourceTreeFixture {
  public static readonly root: string = fileURLToPath(new URL("../../../", import.meta.url));

  public static locateScript(name: string): string {
    return path.join(SourceTreeFixture.root, "scripts", name);
  }
}
