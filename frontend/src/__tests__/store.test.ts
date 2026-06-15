import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/store/sessionStore";

describe("sessionStore", () => {
  beforeEach(() => useSessionStore.getState().clear());

  it("addTranscript replaces a trailing interim entry", () => {
    const { addTranscript } = useSessionStore.getState();
    addTranscript({ id: "interim", text: "hel", interim: true, timestamp: "t1" });
    addTranscript({ id: "interim", text: "hello", interim: true, timestamp: "t2" });
    addTranscript({ id: "f1", text: "hello world", timestamp: "t3" });
    const list = useSessionStore.getState().transcripts;
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe("hello world");
  });

  it("addResponse prepends to history and sets latest", () => {
    const { addResponse } = useSessionStore.getState();
    addResponse({ type: "summary", data: { summary: "a" } });
    addResponse({ type: "quiz", data: { questions: [] } });
    const s = useSessionStore.getState();
    expect(s.latestResponse?.type).toBe("quiz");
    expect(s.aiHistory.map((r) => r.type)).toEqual(["quiz", "summary"]);
  });

  it("setTranscripts and clear work", () => {
    useSessionStore.getState().setTranscripts([{ id: "1", text: "x", timestamp: "t" }]);
    expect(useSessionStore.getState().transcripts).toHaveLength(1);
    useSessionStore.getState().clear();
    expect(useSessionStore.getState().transcripts).toHaveLength(0);
    expect(useSessionStore.getState().latestResponse).toBeNull();
  });
});
