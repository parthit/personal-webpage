import type { SegmentedOption } from "@/components/ui/segmented-control";
import type { WriteMode } from "@/lib/replication/model";

/** Shared so the leader/follower and stale-read figures teach the same words. */
export const WRITE_MODE_OPTIONS: SegmentedOption<WriteMode>[] = [
  {
    value: "synchronous",
    label: "Synchronous",
    hint: "The leader waits for a follower to confirm before it answers the client. Slower, but an acknowledged write already exists on two machines.",
  },
  {
    value: "asynchronous",
    label: "Asynchronous",
    hint: "The leader answers the client first and ships the write afterwards. Fast, but followers trail behind and can serve stale reads.",
  },
];
