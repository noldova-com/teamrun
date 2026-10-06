/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import DocumentLinkValidator from "../documents/document-link.validator.ts";
import GitAttributesValidator from "../documents/git-attributes.validator.ts";
import MarkdownDocument from "../documents/markdown-document.ts";
import TextFormatValidator from "../documents/text-format.validator.ts";
import type RepositoryFiles from "../repository/repository-files.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class DocumentCheck implements ICheck {
  private static readonly MARKDOWN_EXTENSION: string = ".md";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "Documents";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const formatValidator = new TextFormatValidator();
    const findings: string[] = [];
    const documents: MarkdownDocument[] = [];
    let attributes: string | null = null;
    for (const file of files) {
      const content = await readFile(path.join(this.root, file));
      findings.push(...formatValidator.validate(file, content));
      if (file === GitAttributesValidator.FILE)
        attributes = content.toString("utf8");
      if (file.endsWith(DocumentCheck.MARKDOWN_EXTENSION))
        documents.push(new MarkdownDocument(file, content.toString("utf8")));
    }

    findings.push(...new GitAttributesValidator().validate(attributes));
    const linkValidator = new DocumentLinkValidator(files, documents);
    for (const document of documents)
      findings.push(...linkValidator.validate(document));
    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${files.length} files and the links of ${documents.length} Markdown documents.\n`);
    return findings.length === 0;
  }
}
