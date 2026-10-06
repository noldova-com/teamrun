/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { ProductInfo } from "../models/product-info.js";
import { Resources } from "../resources.js";

export class DataDirectoryOwnedException extends Exception {
  public override readonly name: string = "DataDirectoryOwnedException";
  public readonly root: string;

  public constructor(root: string, options?: ExceptionOptions) {
    super(Resources.formatOwned(ProductInfo.current.name, root), options);

    this.root = root;
  }
}
