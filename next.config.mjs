/**
 * next.config.mjs: Next.js 설정 (MDX, 리다이렉트, 개발 서버)
 * 수정일: 2026-04-08
 */
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const isExport = process.env.NEXT_OUTPUT === 'export';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  devIndicators: false,
  ...(isExport ? { output: 'export' } : process.env.DOCKER_BUILD ? { output: 'standalone' } : {}),
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '10.254.175.93',
  ],
  ...(!isExport ? {
    async redirects() {
      return [
        {
          source: '/docs',
          destination: '/docs/2025/project-alpha',
          permanent: false,
        },
      ];
    },
  } : {}),
};

export default withMDX(config);
