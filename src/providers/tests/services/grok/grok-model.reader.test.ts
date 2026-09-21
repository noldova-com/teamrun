/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { GrokModelReader } from "@noldova/teamrun-providers";

@TestClass
export class GrokModelReaderTests {
  @TestMethod
  public keepsUnknownCapabilitiesUnknownAndUsesOnlyAdvertisedMetadata(): void {
    const response = JsonReader.fromValue({ agentCapabilities: { promptCapabilities: { image: false } }, authMethods: [], _meta: {
      modelState: { currentModelId: "a", availableModels: [{ modelId: "a", name: "A", _meta: {} }] }
    } });
    const model = GrokModelReader.read(response)[0]!;
    Assert.isTrue(model.isDefault);
    Assert.isFalse(model.supportsImages!);
    Assert.isNull(model.effortLevels);
    Assert.isNull(GrokModelReader.version(response));
    Assert.isFalse(GrokModelReader.canAuthenticate(response));
  }
}
