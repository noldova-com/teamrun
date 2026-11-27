/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProcessException } from "../../../../scripts/processes/process.exception.ts";
import { DocsModuleWriter } from "./docs-module-writer.ts";
import { DocsPageFile } from "./docs-page-file.ts";

export class DocsPageGenerator {
  public static readonly GENERATED_FOLDER: string = "_build/docs-generated";

  private static readonly PAGES_FOLDER: string = "src/noldova.teamrun.docs/src/pages";
  private static readonly INDEX_FILE: string = "src/noldova.teamrun.docs/src/index.html";
  private static readonly PAGES_MODULE: string = "pages.ts";
  private static readonly INDEX_MODULE: string = "index-page.ts";
  private static readonly RELEASE_MODULE: string = "release.ts";
  private static readonly PAGES_EXPORT: string = "pageFiles";
  private static readonly INDEX_EXPORT: string = "indexPage";
  private static readonly RELEASE_EXPORT: string = "releasedVersion";
  private static readonly DOCUMENT_EXTENSION: string = ".md";
  private static readonly SITE_LINK: string = "https://teamrun.noldova.dev/";
  private static readonly HOME_FILE: string = "home";
  private static readonly CHANGELOG_FILE: string = "CHANGELOG.md";
  private static readonly RELEASED_VERSION: RegExp = /^## (?!Unreleased$)(.+)$/mu;
  private static readonly DOCUMENT_TITLE: RegExp = /^# ([^\n]*)\n+/u;
  private static readonly PAGE_LINK: RegExp = /\]\(([a-z0-9-]+)\.md(#[^)\s]*)?\)/gu;
  private static readonly TEXT_ENCODING: BufferEncoding = "utf8";

  private readonly root: string;
  private readonly writer: DocsModuleWriter;

  public constructor(root: string) {
    this.root = root;
    this.writer = new DocsModuleWriter(root);
  }

  public async writePagesAsync(): Promise<number> {
    const files = (await readdir(path.join(this.root, DocsPageGenerator.PAGES_FOLDER)))
      .filter(t => path.extname(t) === DocsPageGenerator.DOCUMENT_EXTENSION)
      .sort();
    const pages: DocsPageFile[] = [];
    for (const file of files) {
      const name = path.basename(file, DocsPageGenerator.DOCUMENT_EXTENSION);
      const text = await readFile(path.join(this.root, DocsPageGenerator.PAGES_FOLDER, file), DocsPageGenerator.TEXT_ENCODING);
      pages.push(DocsPageGenerator.formatPage(name, text));
    }
    await this.writer.writeAsync(DocsPageGenerator.locate(DocsPageGenerator.PAGES_MODULE), DocsPageGenerator.PAGES_EXPORT, pages);
    return files.length;
  }

  public async writeIndexAsync(): Promise<void> {
    const index = await readFile(path.join(this.root, DocsPageGenerator.INDEX_FILE), DocsPageGenerator.TEXT_ENCODING);
    await this.writer.writeAsync(DocsPageGenerator.locate(DocsPageGenerator.INDEX_MODULE), DocsPageGenerator.INDEX_EXPORT, index);
  }

  public async writeReleaseAsync(): Promise<void> {
    const release = await this.findReleaseAsync();
    await this.writer.writeAsync(DocsPageGenerator.locate(DocsPageGenerator.RELEASE_MODULE), DocsPageGenerator.RELEASE_EXPORT, String(release[1]).trim());
  }

  private async findReleaseAsync(): Promise<RegExpExecArray> {
    const changelog = await readFile(path.join(this.root, DocsPageGenerator.CHANGELOG_FILE), DocsPageGenerator.TEXT_ENCODING);
    const release = DocsPageGenerator.RELEASED_VERSION.exec(changelog);
    if (Object.isNull(release))
      throw new ProcessException(`${DocsPageGenerator.CHANGELOG_FILE} names no released version, a "## <version>" line.`);
    return release;
  }

  private static locate(...parts: readonly string[]): string {
    return path.posix.join(DocsPageGenerator.GENERATED_FOLDER, ...parts);
  }

  private static formatPage(name: string, text: string): DocsPageFile {
    const title = DocsPageGenerator.DOCUMENT_TITLE.exec(text);
    if (Object.isNull(title))
      throw new ProcessException(`${DocsPageGenerator.PAGES_FOLDER}/${name}${DocsPageGenerator.DOCUMENT_EXTENSION} doesn't start with its title, a "# " line.`);
    const body = text.slice(title[0].length).replace(DocsPageGenerator.PAGE_LINK, (_link: string, target: string, anchor: string | undefined) =>
      `](${DocsPageGenerator.SITE_LINK}${target === DocsPageGenerator.HOME_FILE ? String() : target}${anchor ?? String()})`).trimEnd();
    return new DocsPageFile(name, String(title[1]), body);
  }
}
