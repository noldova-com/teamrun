/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PagesResources } from "./pages-resources.js";

export class PageFiles {
  private readonly root: string;

  public constructor(dataDirectory: string) {
    this.root = join(dataDirectory, PagesResources.directoryName);
  }

  public pathOf(chatId: string, pageId: string): string {
    return join(this.root, chatId, `${pageId}${PagesResources.fileExtension}`);
  }

  public write(chatId: string, pageId: string, html: string): void {
    mkdirSync(join(this.root, chatId), { recursive: true });
    writeFileSync(this.pathOf(chatId, pageId), html);
  }

  public list(): readonly string[] {
    return existsSync(this.root) ? readdirSync(this.root, { withFileTypes: true }).filter(t => t.isDirectory()).map(t => t.name) : [];
  }

  public remove(chatId: string): void {
    rmSync(join(this.root, chatId), { recursive: true, force: true, maxRetries: PagesResources.removeRetries });
  }
}
