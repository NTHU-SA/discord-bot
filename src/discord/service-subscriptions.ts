export type ServiceDestination = { guildId: string; channelId: string };

export async function deliverToServiceDestinations(
  destinations: readonly ServiceDestination[],
  deliver: (destination: ServiceDestination) => Promise<unknown>,
) {
  const outcomes = await Promise.allSettled(destinations.map(deliver));
  const failures = outcomes.flatMap((outcome, index) =>
    outcome.status === "rejected"
      ? [{ destination: destinations[index]!, error: outcome.reason }]
      : [],
  );
  if (failures.length === destinations.length) {
    throw new AggregateError(
      failures.map((failure) => failure.error),
      "Every service destination failed.",
    );
  }
  return {
    delivered: destinations.length - failures.length,
    failedChannelIds: failures.map((failure) => failure.destination.channelId),
  };
}
