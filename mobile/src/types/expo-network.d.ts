declare module "expo-network" {
  export type NetworkState = {
    isConnected?: boolean;
    isInternetReachable?: boolean;
  };

  export function getNetworkStateAsync(): Promise<NetworkState>;
  export function addNetworkStateListener(
    listener: (state: NetworkState) => void,
  ): { remove: () => void };
}
