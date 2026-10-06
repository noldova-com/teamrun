/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { QualifiedName } from "./qualified-name.js";

export class ShellEvents {
  public static readonly notifications: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.notificationsMember);
  public static readonly settingsChanged: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.settingsChangedMember);
  public static readonly work: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.workMember);
  public static readonly commandsChanged: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.commandsChangedMember);
  public static readonly programsChanged: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.programsChangedMember);
  public static readonly recentCommandsChanged: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.recentCommandsChangedMember);
}
