/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BuildIdentity } from "@noldova/teamrun-shell-protocol";

import { ProductInfo } from "./product-info.js";

export class RuntimeBuild {
  public static readonly identity: BuildIdentity = new BuildIdentity(ProductInfo.current.version, BuildIdentity.supportedProtocolVersion, ProductInfo.current.build);
}
