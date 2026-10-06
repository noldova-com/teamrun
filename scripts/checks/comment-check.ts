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

import type RepositoryFiles from "../repository/repository-files.ts";
import CCommentReader from "../structure/c-comment.reader.ts";
import type ICommentReader from "../structure/interfaces/i-comment.reader.ts";
import MarkupCommentReader from "../structure/markup-comment.reader.ts";
import ScriptCommentReader from "../structure/script-comment.reader.ts";
import SourceFile from "../structure/source-file.ts";
import StyleCommentReader from "../structure/style-comment.reader.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class CommentCheck implements ICheck {
  private static readonly READERS: ReadonlyMap<string, ICommentReader> = new Map([
    ...[...SourceFile.SCRIPT_EXTENSIONS].map((t): [string, ICommentReader] => [t, new ScriptCommentReader()]),
    ...[...SourceFile.STYLE_EXTENSIONS].map((t): [string, ICommentReader] => [t, new StyleCommentReader()]),
    [SourceFile.C_EXTENSION, new CCommentReader()],
    [".html", new MarkupCommentReader()]
  ]);
  private static readonly API_DECLARATIONS: string = "src/api/index.d.ts";
  private static readonly LINE_FEED: string = "\n";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "Comments";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let checked = 0;
    let failures = 0;
    for (const file of await this.files.listAsync()) {
      const reader = CommentCheck.READERS.get(path.posix.extname(file));
      if (reader === undefined || file.endsWith(CommentCheck.API_DECLARATIONS))
        continue;
      checked++;
      for (const line of CommentCheck.readCommentLines(reader, await readFile(path.join(this.root, file), "utf8"))) {
        output.write(`${file}:${line}: holds a comment; CODING-STANDARDS.md section 9 allows only the license header in source, tests, scripts and styles.\n`);
        failures++;
      }
    }
    output.write(`Checked ${checked} files for comments other than the license header.\n`);
    return failures === 0;
  }

  private static readCommentLines(reader: ICommentReader, text: string): readonly number[] {
    if (!text.startsWith(reader.header))
      return reader.readCommentLines(text);
    const headerLines = reader.header.split(CommentCheck.LINE_FEED).length - 1;
    return reader.readCommentLines(text.slice(reader.header.length)).map(t => t + headerLines);
  }
}
