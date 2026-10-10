import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ getAsset: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

import { getAsset } from "@/lib/api";
import AssetPage, { generateMetadata } from "./page";

describe("asset route parameters", () => {
  beforeEach(() => {
    vi.mocked(getAsset).mockReset();
    vi.mocked(getAsset).mockResolvedValue(null);
  });

  it("uses Next's decoded ID without decoding a literal percent sign again", async () => {
    const props = { params: Promise.resolve({ id: "%" }), searchParams: Promise.resolve({}) };
    await expect(generateMetadata(props)).resolves.toEqual({ title: "Asset %" });
    await expect(AssetPage(props)).rejects.toThrow("NOT_FOUND");
    expect(getAsset).toHaveBeenCalledWith("%");
  });
});
