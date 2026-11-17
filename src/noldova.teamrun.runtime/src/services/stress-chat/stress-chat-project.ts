/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { AttachmentInput } from "@noldova/teamrun.protocol";

import { PngEncoder } from "./png-encoder.js";
import { StressChatResources } from "./stress-chat-resources.js";

export class StressChatProject {
  private readonly encoder: PngEncoder = new PngEncoder();

  public readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public write(): readonly AttachmentInput[] {
    mkdirSync(join(this.root, StressChatResources.sourceFolderName), { recursive: true });
    mkdirSync(join(this.root, StressChatResources.imagesFolderName), { recursive: true });
    for (const [name, source] of StressChatResources.projectFiles)
      writeFileSync(StressChatResources.formatSourcePath(this.root, name), source);

    return StressChatResources.images.map(t => {
      const data = this.encoder.encode(t);
      writeFileSync(StressChatResources.formatImagePath(this.root, t.name), data);
      return new AttachmentInput(t.name, StressChatResources.pngMediaType, data.toString(StressChatResources.base64Encoding), null);
    });
  }
}
