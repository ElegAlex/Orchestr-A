import { chunkArray } from "../chunk";

describe("chunkArray", () => {
  it("splits an array into chunks of the given size", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when array length <= size", () => {
    expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it("returns chunks of exactly size when array divides evenly", () => {
    const result = chunkArray([1, 2, 3, 4, 5, 6], 3);
    expect(result).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("preserves element order across chunks", () => {
    const input = Array.from({ length: 25 }, (_, i) => i);
    const chunks = chunkArray(input, 10);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toHaveLength(10);
    expect(chunks[2]).toHaveLength(5);
    expect(chunks.flat()).toEqual(input);
  });
});

describe("chunkArray concurrency gate for PER-031", () => {
  /**
   * Simulates the handleExportExcel chunked loop and asserts that no more than
   * `CHUNK_SIZE` requests are in-flight simultaneously.
   */
  it("never fires more than 10 requests at once", async () => {
    const CHUNK_SIZE = 10;
    const TOTAL = 23;
    const clients = Array.from({ length: TOTAL }, (_, i) => ({
      id: `c${i}`,
      name: `Client ${i}`,
    }));

    let maxInFlight = 0;
    let inFlight = 0;

    const mockFetch = jest.fn((_id: string) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<{ projects: [] }>((resolve) => {
        // Resolve asynchronously on next microtask tick
        Promise.resolve().then(() => {
          inFlight--;
          resolve({ projects: [] });
        });
      });
    });

    const results: Array<{ clientId: string; clientName: string; res: { projects: [] } | null }> = [];
    for (const chunk of chunkArray(clients, CHUNK_SIZE)) {
      const chunkResults = await Promise.all(
        chunk.map((c) =>
          mockFetch(c.id)
            .then((res) => ({ clientId: c.id, clientName: c.name, res }))
            .catch(() => ({ clientId: c.id, clientName: c.name, res: null })),
        ),
      );
      results.push(...chunkResults);
    }

    expect(mockFetch).toHaveBeenCalledTimes(TOTAL);
    expect(maxInFlight).toBeLessThanOrEqual(CHUNK_SIZE);
    expect(results).toHaveLength(TOTAL);
    // Order preserved
    results.forEach((r, i) => expect(r.clientId).toBe(`c${i}`));
  });
});
