/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { pageFiles } from "@docs-generated/pages";

import "@noldova/context.core";

import { Resources } from "../../resources";
import { DocsException } from "../exceptions/docs.exception";

export class DocsPageText {
  public static of(file: string): string {
    const page = pageFiles.find(t => t.name === file);
    if (Object.isUndefined(page))
      throw new DocsException(Resources.formatMissingPage(file));
    return page.text;
  }
}
