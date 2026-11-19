/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import "@noldova/context.core";
import { ServiceException } from "@noldova/teamrun.services";
import { ErrorCode } from "@noldova/teamrun.protocol";

import { Guid } from "../../models/guid.js";
import { Resources } from "../../resources.js";

export class ProjectActivity {
  private readonly turns: Map<string, string> = new Map();
  private readonly rewinds: Map<string, string> = new Map();
  private readonly waiting: Set<() => void> = new Set();

  public enterTurn(rootPath: string): string {
    const root = ProjectActivity.rootOf(rootPath);
    this.check(root, this.rewinds.values());
    return this.addTurn(root);
  }

  public tryEnterTurn(rootPath: string): string | null {
    const root = ProjectActivity.rootOf(rootPath);
    return ProjectActivity.holds(root, this.rewinds.values()) ? null : this.addTurn(root);
  }

  public whenReleasedAsync(): Promise<void> {
    return new Promise(resolve => this.waiting.add(resolve));
  }

  public releaseWaiting(): void {
    const waiting = [...this.waiting];
    this.waiting.clear();
    for (const release of waiting)
      release();
  }

  public enter(rootPath: string): string {
    return this.enterAll([rootPath])[0]!;
  }

  public enterAll(rootPaths: readonly string[]): readonly string[] {
    const roots = rootPaths.map(t => ProjectActivity.rootOf(t));
    for (const root of roots) {
      this.check(root, this.turns.values());
      this.check(root, this.rewinds.values());
    }
    return roots.map(root => {
      const id = Guid.createVersion7().toString();
      this.rewinds.set(id, root);
      return id;
    });
  }

  public leave(id: string): void {
    this.turns.delete(id);
    if (this.rewinds.delete(id))
      this.releaseWaiting();
  }

  public requireIdle(rootPath: string): void {
    const root = ProjectActivity.rootOf(rootPath);
    this.check(root, this.turns.values());
    this.check(root, this.rewinds.values());
  }

  public static rootOf(rootPath: string): string {
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

  private addTurn(root: string): string {
    const id = Guid.createVersion7().toString();
    this.turns.set(id, root);
    return id;
  }

  private check(root: string, roots: Iterable<string>): void {
    if (ProjectActivity.holds(root, roots))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatProjectBusy(root), [root]);
  }

  private static holds(root: string, roots: Iterable<string>): boolean {
    return [...roots].some(t => ProjectActivity.contains(t, root) || ProjectActivity.contains(root, t));
  }

  private static contains(root: string, target: string): boolean {
    const path = relative(root, target);
    return !isAbsolute(path) && !Resources.parentPathPattern.test(path);
  }
}
