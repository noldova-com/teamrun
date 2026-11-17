/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class ImageDataReader {
  public static mediaTypeOf(data: string | null): string | null {
    if (Object.isNull(data) || data.length > Resources.maximumImageDataLength || !Resources.base64Pattern.test(data))
      return null;
    for (const [signature, mediaType] of Object.entries(Resources.imageSignatures))
      if (data.startsWith(signature))
        return mediaType;

    return null;
  }
}
