/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { type NotificationPost, ShellNotifications } from "@noldova/teamrun-shell-protocol";

import { RegistrationException } from "../../exceptions/registration.exception.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { Resources } from "../../resources.js";

export class NotificationPolicy {
  private readonly declarations: readonly ModuleDeclaration[];
  private readonly isActive: (moduleId: string) => boolean;

  public constructor(declarations: readonly ModuleDeclaration[], isActive: (moduleId: string) => boolean) {
    this.declarations = declarations;
    this.isActive = isActive;
  }

  public findRefusal(post: NotificationPost): string | null {
    if (post.kind.isShell)
      return NotificationPolicy.findShellRefusal(post);
    const declaration = this.declarations.find(t => t.id === post.kind.owner);
    if (Object.isUndefined(declaration) || !this.isActive(declaration.id))
      return Resources.formatNotificationModuleInactive(post.kind.owner, post.kind.text);
    return NotificationPolicy.findDeclaredRefusal(declaration, post);
  }

  public requireDeclared(declaration: ModuleDeclaration, post: NotificationPost): void {
    const refusal = NotificationPolicy.findDeclaredRefusal(declaration, post);
    if (!Object.isNull(refusal))
      throw new RegistrationException(refusal);
  }

  private static findShellRefusal(post: NotificationPost): string | null {
    if (!ShellNotifications.all.some(t => t.text === post.kind.text))
      return Resources.formatShellNotificationUnknown(post.kind.text);
    return Object.isNull(post.open) && post.actions.length === 0 ? null : Resources.formatShellNotificationCommand(post.kind.text);
  }

  private static findDeclaredRefusal(declaration: ModuleDeclaration, post: NotificationPost): string | null {
    if (!declaration.listContributions(Resources.notificationsKind).includes(post.kind.text))
      return Resources.formatNotContributed(declaration.id, Resources.notificationsKind, post.kind.text);
    const commands = [...Object.isNull(post.open) ? [] : [post.open], ...post.actions.map(t => t.command)];
    const refused = commands.find(t => t.name.owner !== declaration.id && !declaration.dependencies.includes(t.name.owner));
    return Object.isUndefined(refused) ? null : Resources.formatNotificationCommandNotAllowed(declaration.id, refused.name.text);
  }
}
