/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrokSignOutReader, Resources } from "@noldova/teamrun.providers";

@TestClass
export class GrokSignOutReaderTests {
  @TestMethod
  public triesTheNamespacedLogoutThenThePlainOne(): void {
    const reader = new GrokSignOutReader();

    Assert.areEqual("_x.ai/auth/logout,x.ai/auth/logout", reader.methods.join(","));
    Assert.areEqual(Resources.xaiLogoutMethods, reader.methods);
  }

  @TestMethod
  public readsASignOutOnlyFromOkAndNamesAnApiKeyThatStillSignsGrokIn(): void {
    const reader = new GrokSignOutReader();

    Assert.isNull(reader.read({ ok: true, was_logged_in: true, email: "person@example.com", api_key_still_set: false }));
    Assert.isNull(reader.read({ ok: true }));
    Assert.areEqual(Resources.grokApiKeyStillSet, reader.read({ ok: true, was_logged_in: true, email: null, api_key_still_set: true }));
    Assert.areEqual(Resources.grokSignOutRefused, reader.read({ ok: false, api_key_still_set: true }));
    Assert.areEqual(Resources.grokSignOutRefused, reader.read({ ok: "true" }));
    Assert.areEqual(Resources.grokSignOutRefused, reader.read(null));
    Assert.areEqual("Grok signed out of its account but still has an xAI API key, from XAI_API_KEY or saved in the profile folder, and keeps using it.",
      Resources.grokApiKeyStillSet);
  }
}
