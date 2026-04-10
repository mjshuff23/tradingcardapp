import { LinkPreviewService } from "../src/scan/link-preview.service";

describe("LinkPreviewService", () => {
  const service = new LinkPreviewService();

  it("marks i.ebayimg.com images as proxy-eligible", () => {
    expect(
      service.shouldProxyPreviewImage(
        "https://i.ebayimg.com/images/g/ClwAAOSwffFi4wfr/s-l500.webp",
      ),
    ).toBe(true);
  });

  it("does not proxy non-ebay image hosts", () => {
    expect(
      service.shouldProxyPreviewImage("https://images.example.com/card.webp"),
    ).toBe(false);
    expect(service.shouldProxyPreviewImage(null)).toBe(false);
  });
});
