import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Do not write AGENTS.md / CLAUDE.md into the project on `next dev`.
  agentRules: false,
  // No floating dev-tools badge over the scene.
  devIndicators: false,
  // Treat this folder as the project root even inside a bigger repository.
  turbopack: { root: path.resolve(import.meta.dirname) },
  outputFileTracingRoot: path.resolve(import.meta.dirname),
}

export default nextConfig
