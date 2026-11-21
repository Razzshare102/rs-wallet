import { brandShareImage } from "@/lib/brand-image";

export const alt = "RS WALLET — Non-custodial EVM Wallet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return brandShareImage();
}
