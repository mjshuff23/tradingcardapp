export type SourceHint = {
  source: "ebay_sold" | "psa" | "web_lookup";
  url: string;
  title: string;
  score: number;
  provider?: string;
  imageUrl?: string;
};
