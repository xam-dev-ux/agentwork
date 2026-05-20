/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // suppress optional peer dep warnings from MetaMask SDK and WalletConnect
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
