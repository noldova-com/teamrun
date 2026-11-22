/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ServiceException } from "@noldova/teamrun.services";
import { ErrorCode, type Message, type Provenance } from "@noldova/teamrun.protocol";
import { Resources } from "../resources.js";

export class ReplyProvenance {
  public static of(reply: Message): Provenance {
    const provenance = reply.provenance;
    if (Object.isNull(provenance))
      throw new ServiceException(ErrorCode.Internal, Resources.formatReplyWithoutProvenance(reply.id), [reply.id]);
    return provenance;
  }
}
