/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class ProductIdentityFixture {
  public static readonly json: Readonly<Record<string, unknown>> = {
    name: "Fixture Studio",
    publisher: "Fixture Works",
    slug: "fixture-studio",
    applicationId: "org.fixtureworks.studio",
    developmentApplicationId: "org.fixtureworks.studio.development",
    dataFolder: ".fixtureworks/studio",
    deviceFolders: { windows: "Fixture Works/Studio", macos: "Fixture Works/Studio Mac", linux: "fixtureworks/studio" },
    dataDirectoryVariable: "FIXTURE_STUDIO_DATA_DIR",
    icons: "assets/fixture-icons",
    releaseRepository: "fixtureworks/studio",
    windowsPublisher: "CN=Fixture Works, O=Fixture Works, L=Fixtureville, C=US"
  };

  public static manifest(overrides: Readonly<Record<string, unknown>> = {}, modules: readonly string[] = [], settings: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
    return { version: "0.0.7", teamrun: { protocolVersion: 3, modules, product: { ...ProductIdentityFixture.json, ...overrides }, ...settings } };
  }
}
