import type { MessageProposal } from "./messageOutbox";
import { assertOnline } from "./connectivity";

/** Direct send reads never enter TanStack's paused query queue. */
export async function messageSendStep<T>(
  message: MessageProposal,
  assertCurrent: (message: MessageProposal) => void,
  operation: () => PromiseLike<T>,
): Promise<T> {
  assertOnline();
  assertCurrent(message);
  const result = await operation();
  assertOnline();
  assertCurrent(message);
  return result;
}

/** Local persistence must precede MutationCache's network guard. */
export async function persistMessageBeforeSend(
  message: MessageProposal,
  dependencies: {
    assertCurrent: (message: MessageProposal) => void;
    save: (message: MessageProposal) => Promise<void>;
    persisted: (message: MessageProposal) => void;
    send: (message: MessageProposal) => Promise<unknown>;
  },
) {
  const snapshot: MessageProposal = JSON.parse(JSON.stringify(message));
  dependencies.assertCurrent(snapshot);
  await dependencies.save(snapshot);
  dependencies.persisted(snapshot);
  // A switch or unmount while writing the journal keeps A's draft, but must
  // never dispatch it from the newly displayed conversation/account.
  dependencies.assertCurrent(snapshot);
  await dependencies.send(snapshot);
}
