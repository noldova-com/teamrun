/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { Guid } from "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources.js";

export class ProjectActivity {
  private readonly turns: Map<string, string> = new Map();
  private readonly rewinds: Map<string, string> = new Map();

  public enterTurn(rootPath: string): string {
    const root = ProjectActivity.rootOf(rootPath);
    this.check(root, this.rewinds.values());
    const id = Guid.createVersion7().toString();
    this.turns.set(id, root);
    return id;
  }

  public enter(rootPath: string): string {
    const root = ProjectActivity.rootOf(rootPath);
    this.check(root, this.turns.values());
    this.check(root, this.rewinds.values());
    const id = Guid.createVersion7().toString();
    this.rewinds.set(id, root);
    return id;
  }

  public leave(id: string): void {
    this.turns.delete(id);
    this.rewinds.delete(id);
  }

  public requireIdle(rootPath: string): void {
    const root = ProjectActivity.rootOf(rootPath);
    this.check(root, this.turns.values());
    this.check(root, this.rewinds.values());
  }

  private check(root: string, roots: Iterable<string>): void {
    for (const active of roots)
      if (ProjectActivity.contains(active, root) || ProjectActivity.contains(root, active))
        throw new ServiceException(ErrorCode.Conflict, Resources.formatProjectBusy(root), [root]);
  }

  private static contains(root: string, target: string): boolean {
    const path = relative(root, target);
    return !isAbsolute(path) && !Resources.parentPathPattern.test(path);
  }

  private static rootOf(rootPath: string): string {
    const resolved = resolve(rootPath);
    let ancestor = resolved;
    while (!existsSync(ancestor) && dirname(ancestor) !== ancestor)
      ancestor = dirname(ancestor);
    const root = resolve(realpathSync.native(ancestor), relative(ancestor, resolved));
    let current = root;
    for (;;) {
      if (existsSync(join(current, Resources.gitDirectoryName)))
        return current;
      const parent = dirname(current);
      if (parent === current)
        return root;
      current = parent;
    }
  }
}
