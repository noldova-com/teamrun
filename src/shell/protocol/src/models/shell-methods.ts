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
  public static readonly work: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.workMember);
  public static readonly commands: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.commandsMember);
  public static readonly runCommand: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.runCommandMember);
  public static readonly notifications: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.notificationsMember);
  public static readonly postNotification: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.postNotificationMember);
  public static readonly updateNotification: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.updateNotificationMember);
  public static readonly dismissNotification: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.dismissNotificationMember);
  public static readonly markNotificationsRead: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.markNotificationsReadMember);
  public static readonly clearNotifications: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.clearNotificationsMember);
  public static readonly readWindowBounds: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.readWindowBoundsMember);
  public static readonly writeWindowBounds: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.writeWindowBoundsMember);
  public static readonly readWindowLayout: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.readWindowLayoutMember);
  public static readonly writeWindowLayout: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.writeWindowLayoutMember);
  public static readonly settings: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.settingsMember);
  public static readonly readSetting: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.readSettingMember);
  public static readonly setSetting: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.setSettingMember);
  public static readonly resetSetting: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.resetSettingMember);
  public static readonly recentCommands: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.recentCommandsMember);
  public static readonly recordCommand: QualifiedName = new QualifiedName(Resources.shellOwner, Resources.recordCommandMember);
}
