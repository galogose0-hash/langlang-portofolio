/** @type {import('next').NextConfig} */
// Static export so the game can be dropped into any plain HTML/CSS/JS site.
// Served from a sub-folder, so we set basePath/assetPrefix.
// Default matches the portfolio layout (porto/game/catur3d -> "/game/catur3d").
// Override with e.g. (PowerShell):  $env:NEXT_BASE_PATH="/foo"; npm run build
const raw = process.env.NEXT_BASE_PATH;
const basePath = raw === undefined ? "/game/catur3d" : raw;

const nextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
