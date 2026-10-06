/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Project, SymbolFlags } from "typescript/unstable/async";
import type { Node } from "typescript/unstable/ast";

import ApiDocComment from "./api-doc-comment.ts";
import ApiExample from "./api-example.ts";
import ApiExamples from "./api-examples.ts";
import ApiSymbolWalker from "./api-symbol-walker.ts";
import type ApiVisibility from "./api-visibility.ts";

export default class ApiExampleReader {
  private static readonly CALLABLE: number = SymbolFlags.Function | SymbolFlags.Method | SymbolFlags.Constructor;

  private readonly walker: ApiSymbolWalker;

  public constructor(project: Project, visibility: ApiVisibility) {
    this.walker = new ApiSymbolWalker(project, visibility);
  }

  public async readAsync(file: string): Promise<ApiExamples> {
    const examples: ApiExample[] = [];
    const undocumented: string[] = [];
    await this.walker.walkAsync(file, async (path, symbol, declarations) =>
      ApiExampleReader.collect(path, declarations, (symbol.flags & ApiExampleReader.CALLABLE) !== 0, examples, undocumented));
    return new ApiExamples(examples, undocumented);
  }

  private static collect(owner: string, declarations: readonly Node[], isRequired: boolean, examples: ApiExample[], undocumented: string[]): void {
    const found = declarations.flatMap(t => (t.jsDoc ?? []).flatMap(doc => new ApiDocComment(doc.getText()).readExamples(owner)));
    if (isRequired && found.length === 0)
      undocumented.push(owner);
    found.forEach((t, index) => examples.push(new ApiExample(owner, index + 1, t)));
  }
}
