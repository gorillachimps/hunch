import { polygon } from "viem/chains";
import { http } from "wagmi";
import { createConfig } from "@privy-io/wagmi";
import { POLYGON_RPC_URL } from "./env-client";

export const wagmiConfig = createConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: http(POLYGON_RPC_URL),
  },
});
