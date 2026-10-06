/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as nodeModule from "node:module";

import type ITypeStripApi from "./interfaces/i-type-strip-api.ts";
import TypeStripException from "./type-strip.exception.ts";

export default class TypeStripper {
  private static readonly UNSUPPORTED_SYNTAX_CODE: string = "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX";
  private static readonly ENUM_REFUSAL: string = "TypeScript enum is not supported in strip-only mode";

  private readonly stripTypes: ((code: string) => string) | undefined;

  public constructor(api: ITypeStripApi = nodeModule) {
    this.stripTypes = api.stripTypeScriptTypes;
  }

  public strip(filePath: string, text: string): string {
    if (this.stripTypes === undefined)
      throw new TypeStripException(`${filePath}: this Node.js has no module.stripTypeScriptTypes, so the test mirror check cannot tell which files have function bodies; TESTING.md section 5 names the API and what to do when Node.js changes it.`);
    try {
      return this.stripTypes(text);
    }
    catch (error) {
      if (TypeStripper.isEnumRefusal(error))
        return text;
      throw new TypeStripException(`${filePath}: module.stripTypeScriptTypes could not strip its types.`, { cause: error });
    }
  }

  private static isEnumRefusal(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === TypeStripper.UNSUPPORTED_SYNTAX_CODE && error.message.startsWith(TypeStripper.ENUM_REFUSAL);
  }
}
