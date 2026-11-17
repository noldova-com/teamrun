/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class FileGrantException extends WindowException {
  public override readonly name: string = "FileGrantException";
  public readonly fileName: string;

  public constructor(fileName: string) {
    super(Resources.attachmentReadFailed);
    this.fileName = fileName;
  }
}
