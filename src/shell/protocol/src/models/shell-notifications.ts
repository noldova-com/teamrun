/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { QualifiedName } from "./qualified-name.js";

export class ShellNotifications {
  public static readonly saveFailed: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.saveFailedMember);
  public static readonly saveUnfinished: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.saveUnfinishedMember);
  public static readonly all: readonly QualifiedName[] = [ShellNotifications.saveFailed, ShellNotifications.saveUnfinished];
}
