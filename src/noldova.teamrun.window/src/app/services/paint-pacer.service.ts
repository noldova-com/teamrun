/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class PaintPacerService {
  public afterPaint(done: () => void): () => void {
    let channel: MessageChannel | null = null;
    const frame = requestAnimationFrame(() => {
      channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel?.port1.close();
        done();
      };
      channel.port2.postMessage(null);
    });
    return () => {
      cancelAnimationFrame(frame);
      channel?.port1.close();
    };
  }
}
