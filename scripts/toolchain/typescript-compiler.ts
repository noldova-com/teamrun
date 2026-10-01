/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire } from "node:module";
import path from "node:path";

export default class TypeScriptCompiler {
  private static readonly MANIFEST: string = "typescript/package.json";
  private static readonly COMPILER_PATH: string = "bin/tsc";

  public static locate(): string {
    return path.join(path.dirname(createRequire(import.meta.url).resolve(TypeScriptCompiler.MANIFEST)), TypeScriptCompiler.COMPILER_PATH);
  }
}
