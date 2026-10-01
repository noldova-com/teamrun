/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type MarkdownDocument from "./markdown-document.ts";
import type MarkdownLink from "./markdown-link.ts";

export default class DocumentLinkValidator {
  private static readonly REPOSITORY_URL: string = "https://github.com/noldova-com/teamrun/";
  private static readonly REPOSITORY_FILE_PATTERN: RegExp = /^(?:blob|tree)\/main\/(.*)$/;
  private static readonly SCHEME_PATTERN: RegExp = /^[a-z][a-z0-9+.-]*:/i;
  private static readonly EXTERNAL_PROTOCOLS: readonly string[] = ["http:", "https:", "mailto:"];
  private static readonly ANCHOR_SEPARATOR: string = "#";
  private static readonly ROOT_PREFIX: string = "/";
  private static readonly PARENT_FOLDER: string = "..";
  private static readonly ROOT_FOLDERS: readonly string[] = [".", ""];
  private static readonly MARKDOWN_EXTENSION: string = ".md";
  private static readonly TRAILING_SEPARATOR_PATTERN: RegExp = /\/+$/;
  private static readonly OUTSIDE: string = "points outside the repository";
  private static readonly INVALID_PATH: string = "has an invalid percent-encoded path";
  private static readonly INVALID_URL: string = "is not a valid URL";
  private static readonly UNSUPPORTED_PROTOCOL: string = "uses an unsupported protocol";
  private static readonly MISSING_FILE: string = "points to a missing file";

  private readonly files: ReadonlySet<string>;
  private readonly folders: ReadonlySet<string>;
  private readonly documents: ReadonlyMap<string, MarkdownDocument>;

  public constructor(files: readonly string[], documents: readonly MarkdownDocument[]) {
    const folders = new Set<string>(DocumentLinkValidator.ROOT_FOLDERS);
    for (const file of files)
      for (let folder = path.posix.dirname(file); !folders.has(folder); folder = path.posix.dirname(folder))
        folders.add(folder);

    this.files = new Set<string>(files);
    this.folders = folders;
    this.documents = new Map<string, MarkdownDocument>(documents.map(t => [t.path, t]));
  }

  public validate(document: MarkdownDocument): readonly string[] {
    const findings: string[] = [];
    for (const link of document.links) {
      const problem = this.findProblem(document, link);
      if (problem !== null)
        findings.push(`${document.path}:${link.line}: the link "${link.target}" ${problem}.`);
    }
    return findings;
  }

  private static findExternalProblem(target: string): string | null {
    if (!URL.canParse(target))
      return DocumentLinkValidator.INVALID_URL;
    return DocumentLinkValidator.EXTERNAL_PROTOCOLS.includes(new URL(target).protocol) ? null : DocumentLinkValidator.UNSUPPORTED_PROTOCOL;
  }

  private static decode(target: string): string | null {
    try {
      return decodeURIComponent(target);
    }
    catch {
      return null;
    }
  }

  private findProblem(document: MarkdownDocument, link: MarkdownLink): string | null {
    if (link.target.startsWith(DocumentLinkValidator.REPOSITORY_URL))
      return this.findRepositoryProblem(link.target.slice(DocumentLinkValidator.REPOSITORY_URL.length));
    if (DocumentLinkValidator.SCHEME_PATTERN.test(link.target))
      return DocumentLinkValidator.findExternalProblem(link.target);

    const separator = link.target.indexOf(DocumentLinkValidator.ANCHOR_SEPARATOR);
    const target = separator < 0 ? link.target : link.target.slice(0, separator);
    const anchor = separator < 0 ? null : link.target.slice(separator + 1);
    if (target.length === 0)
      return this.findLocalProblem(document.path, anchor);

    const decoded = DocumentLinkValidator.decode(target);
    if (decoded === null)
      return DocumentLinkValidator.INVALID_PATH;
    const resolved = decoded.startsWith(DocumentLinkValidator.ROOT_PREFIX)
      ? path.posix.normalize(decoded.slice(DocumentLinkValidator.ROOT_PREFIX.length))
      : path.posix.join(path.posix.dirname(document.path), decoded);
    return this.findLocalProblem(resolved, anchor);
  }

  private findRepositoryProblem(location: string): string | null {
    const file = DocumentLinkValidator.REPOSITORY_FILE_PATTERN.exec(location)?.[1];
    if (file === undefined)
      return null;

    const separator = file.indexOf(DocumentLinkValidator.ANCHOR_SEPARATOR);
    const target = DocumentLinkValidator.decode(separator < 0 ? file : file.slice(0, separator));
    if (target === null)
      return DocumentLinkValidator.INVALID_PATH;
    return this.findLocalProblem(path.posix.normalize(target), separator < 0 ? null : file.slice(separator + 1));
  }

  private findLocalProblem(target: string, anchor: string | null): string | null {
    const file = target.replace(DocumentLinkValidator.TRAILING_SEPARATOR_PATTERN, "");
    if (file === DocumentLinkValidator.PARENT_FOLDER || file.startsWith(`${DocumentLinkValidator.PARENT_FOLDER}/`))
      return DocumentLinkValidator.OUTSIDE;
    if (!this.files.has(file) && !this.folders.has(file))
      return DocumentLinkValidator.MISSING_FILE;
    if (anchor === null || !file.endsWith(DocumentLinkValidator.MARKDOWN_EXTENSION))
      return null;
    return this.documents.get(file)?.anchors.has(anchor) === true ? null : `points to a missing heading "#${anchor}"`;
  }
}
