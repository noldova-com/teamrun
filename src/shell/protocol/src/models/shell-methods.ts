/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { QualifiedName } from "./qualified-name.js";

export class ShellMethods {
  public static readonly stop: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.stopMember);
  public static readonly moveAside: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.moveAsideMember);
  public static readonly modules: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.modulesMember);
}
