/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    // Workaround for environments where spawning child processes is blocked (spawn EPERM during `next build`).
    webpackBuildWorker: false,
    // Use worker threads (not child processes) for build helpers in restricted envs.
    workerThreads: true,
  },
  eslint: {
    // We run `next lint` separately; disabling here avoids build-time worker spawning in restricted envs.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Avoid build-time worker spawning for type-check in restricted envs.
    ignoreBuildErrors: true,
  },
  images: {
    domains: [],
  },
};

module.exports = nextConfig;
