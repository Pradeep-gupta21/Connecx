export const CREATOR_CATEGORIES = [
  "Fashion",
  "Beauty",
  "Tech",
  "Gaming",
  "Lifestyle",
  "Food & Drink",
  "Travel",
  "Fitness",
  "Finance",
  "Education",
  "Music",
  "Art & Design",
  "Parenting",
  "Business",
] as const;

export const INDUSTRIES = [
  "Consumer Goods",
  "Software",
  "Apparel",
  "Beauty",
  "Food & Beverage",
  "Travel",
  "Fintech",
  "Health",
  "Entertainment",
  "Other",
] as const;

export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number];
export type Industry = (typeof INDUSTRIES)[number];
