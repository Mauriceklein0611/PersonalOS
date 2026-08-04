import { describe, expect, it, vi } from "vitest";

import { canReachOrigin } from "./online-status";

describe("canReachOrigin", () => {
  it("reports a failed same-origin probe as offline", async () => {
    const fetchFromOrigin = vi.fn(() =>
      Promise.reject(new TypeError("offline")),
    );

    expect(await canReachOrigin(fetchFromOrigin)).toBe(false);
    expect(fetchFromOrigin).toHaveBeenCalledOnce();
    expect(fetchFromOrigin).toHaveBeenCalledWith(
      expect.stringMatching(/^\/__personalos-online-check__\?time=/),
      expect.objectContaining({ cache: "no-store", method: "HEAD" }),
    );
  });

  it("accepts any network response as proof that the origin is reachable", async () => {
    const fetchFromOrigin = vi.fn(() => Promise.resolve(new Response(null)));

    expect(await canReachOrigin(fetchFromOrigin)).toBe(true);
  });
});
