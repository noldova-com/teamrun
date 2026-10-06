/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Symbol } from "typescript/unstable/async";
import type { Node } from "typescript/unstable/ast";

export default interface IApiSymbolVisitor {
  (path: string, symbol: Symbol, declarations: readonly Node[]): Promise<void>;
}
