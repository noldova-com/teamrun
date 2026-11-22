/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A file, folder or link in a chat folder, by its path relative to the folder. */
export class ChatFolderEntry {
  public readonly path: string;
  public readonly isDirectory: boolean;
  public readonly isLink: boolean;

  public constructor(path: string, isDirectory: boolean, isLink: boolean) {
    this.path = path;
    this.isDirectory = isDirectory;
    this.isLink = isLink;
  }
}
