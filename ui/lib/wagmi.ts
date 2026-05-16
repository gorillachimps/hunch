import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { http } from "wagmi";
import { createConfig } from "@privy-io/wagmi";
import { POLYGON_RPC_URL } from "./env-client";

// Polygon stays the trading chain. The other four are added so the user's
// wallet can switch to them when initiating an Across bridge from there;
// no transport URL is required beyond viem's public-RPC default.
export const wagmiConfig = createConfig({
  chains: [polygon, mainnet, optimism, arbitrum, base],
  transports: {
    [polygon.id]: http(POLYGON_RPC_URL),
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
});
