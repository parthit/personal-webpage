import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_OG_IMAGE, SITE_NAME, socialShareImage } from "./site";

describe("socialShareImage", () => {
  it("keeps raster covers for social cards", () => {
    assert.deepEqual(socialShareImage("/content/images/writing/demo/cover.jpg", "Demo"), {
      url: "/content/images/writing/demo/cover.jpg",
      alt: "Demo",
    });
  });

  it("falls back when the cover is an SVG", () => {
    assert.deepEqual(
      socialShareImage("/content/images/writing/demo/cover.svg", "Demo"),
      {
        url: DEFAULT_OG_IMAGE,
        alt: SITE_NAME,
      }
    );
  });

  it("falls back when no cover is provided", () => {
    assert.deepEqual(socialShareImage(undefined, "Demo"), {
      url: DEFAULT_OG_IMAGE,
      alt: SITE_NAME,
    });
  });
});
