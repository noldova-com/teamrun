/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ICommentReader from "./interfaces/i-comment.reader.ts";
import LicenseHeader from "./license-header.ts";
import SourceScanner from "./source-scanner.ts";

export default class ScriptCommentReader implements ICommentReader {
  public readonly header: string = LicenseHeader.BLOCK;

  public readCommentLines(text: string): readonly number[] {
    return new SourceScanner(text).scan().comments;
  }
}
