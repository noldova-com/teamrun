/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpAgentEntry, AcpAgentListing } from "@noldova/teamrun.protocol";

@TestClass
export class AcpAgentListingTests {
  @TestMethod
  public keepsItsAgentsLocalCommandsFailureAndTime(): void {
    const agent = new AcpAgentEntry("droid", "Droid", "1.1.0", "An agent", "https://example.com/droid", null, false, true);
    const local = new AcpAgentEntry("local-mine", "Mine", "", "", null, "Reason", true, true);
    const listing = new AcpAgentListing([agent], [local], "The list is old.", "2026-11-01T00:00:00.000Z");

    const read = AcpAgentListing.fromJson(JSON.parse(JSON.stringify(listing.toJson())) as unknown);

    Assert.areEqual(JSON.stringify(listing.toJson()), JSON.stringify(read.toJson()));
    Assert.areEqual("droid|Droid|1.1.0|An agent|https://example.com/droid|null|false|true", [read.agents[0]!.id, read.agents[0]!.name, read.agents[0]!.version, read.agents[0]!.description,
      read.agents[0]!.about, read.agents[0]!.unavailable, read.agents[0]!.notChecked, read.agents[0]!.added].map(String).join("|"));
    Assert.areEqual("local-mine|Reason|true", [read.localCommands[0]!.id, read.localCommands[0]!.unavailable, read.localCommands[0]!.notChecked].join("|"));
    Assert.areEqual("The list is old.|2026-11-01T00:00:00.000Z", `${read.failure}|${read.fetchedAt}`);
    Assert.areEqual("null|null", (t => `${t.failure}|${t.fetchedAt}`)(AcpAgentListing.fromJson(new AcpAgentListing([], [], null, null).toJson())));
  }

  @TestMethod
  public refusesAnEntryWithNoIdOrNameAndAListingWithNoAgents(): void {
    Assert.areEqual("id", Assert.throws(() => new AcpAgentEntry(" ", "Droid", "", "", null, null, false, false), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new AcpAgentEntry("droid", " ", "", "", null, null, false, false), ArgumentException).parameterName);
    Assert.areEqual("$.l.agents", Assert.throws(() => AcpAgentListing.fromJson({}, "$.l"), JsonException).path);
    Assert.areEqual("$.e.id", Assert.throws(() => AcpAgentEntry.fromJson({}, "$.e"), JsonException).path);
  }
}
