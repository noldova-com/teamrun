/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShortcutRow {
  public readonly name: string;
  public readonly title: string;
  public readonly owner: string;
  public readonly key: string;
  public readonly hasKey: boolean;
  public readonly isModified: boolean;
  public readonly collision: string | null;

  public constructor(name: string, title: string, owner: string, key: string, hasKey: boolean, isModified: boolean, collision: string | null) {
    this.name = name;
    this.title = title;
    this.owner = owner;
    this.key = key;
    this.hasKey = hasKey;
    this.isModified = isModified;
    this.collision = collision;
  }
}
