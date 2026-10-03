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
  public readonly key: string;
  public readonly collision: string | null;

  public constructor(name: string, title: string, key: string, collision: string | null) {
    this.name = name;
    this.title = title;
    this.key = key;
    this.collision = collision;
  }
}
