import { Injectable, Logger } from "@nestjs/common";

type PreviewCacheEntry = {
  imageUrl: string | null;
  expiresAt: number;
};

export type PreviewImagePayload = {
  buffer: Buffer;
  contentType: string;
};

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly cache = new Map<string, PreviewCacheEntry>();
  private readonly ttlMs = 1000 * 60 * 60 * 12;

  async getPreviewImage(url: string): Promise<string | null> {
    if (!url) {
      return null;
    }

    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.imageUrl;
    }

    const imageUrl = await this.resolvePreviewImage(url);
    this.cache.set(url, {
      imageUrl,
      expiresAt: Date.now() + this.ttlMs,
    });

    return imageUrl;
  }

  shouldProxyPreviewImage(url: string | null | undefined): boolean {
    if (!url) {
      return false;
    }

    try {
      const parsed = new URL(url);
      return parsed.hostname.toLowerCase() === "i.ebayimg.com";
    } catch {
      return false;
    }
  }

  async getTrustedPreviewImage(
    url: string,
  ): Promise<PreviewImagePayload | null> {
    const imageUrl = await this.getPreviewImage(url);
    if (!this.shouldProxyPreviewImage(imageUrl)) {
      return null;
    }

    return this.fetchImage(imageUrl);
  }

  private async resolvePreviewImage(url: string): Promise<string | null> {
    if (this.isDirectImageUrl(url)) {
      return url;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        },
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.startsWith("image/")) {
        return response.url || url;
      }

      const html = await response.text();
      const image =
        this.extractMetaImage(html, response.url || url) ||
        this.extractFallbackImage(html, response.url || url);
      return image;
    } catch (error) {
      this.logger.debug(
        `Preview lookup failed for ${url}: ${(error as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchImage(url: string): Promise<PreviewImagePayload | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        },
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        buffer,
        contentType,
      };
    } catch (error) {
      this.logger.debug(
        `Image fetch failed for ${url}: ${(error as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractMetaImage(html: string, pageUrl: string): string | null {
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match?.[1]) {
        continue;
      }

      try {
        return new URL(match[1], pageUrl).toString();
      } catch {
        continue;
      }
    }

    return null;
  }

  private extractFallbackImage(html: string, pageUrl: string): string | null {
    const matches = Array.from(
      html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi),
    );

    for (const match of matches) {
      const candidate = match[1];
      if (!candidate) {
        continue;
      }

      try {
        const absolute = new URL(candidate, pageUrl).toString();
        if (!this.isLikelyCardImage(absolute)) {
          continue;
        }
        return absolute;
      } catch {
        continue;
      }
    }

    return null;
  }

  private isLikelyCardImage(url: string): boolean {
    const lower = url.toLowerCase();

    if (!/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(lower)) {
      return false;
    }

    if (
      lower.includes("sprite") ||
      lower.includes("icon") ||
      lower.includes("logo") ||
      lower.includes("avatar") ||
      lower.includes("favicon")
    ) {
      return false;
    }

    return true;
  }

  private isDirectImageUrl(url: string): boolean {
    return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url);
  }
}
