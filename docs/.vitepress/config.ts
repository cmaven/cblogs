/**
 * config.ts: VitePress 사이트 설정 - 네비게이션, 사이드바, 버전 전환 포함
 * 생성일: 2026-04-08 | 수정일: 2026-04-08
 */
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Tech Docs Portal',
  description: '사내 기술 문서 포털',
  lang: 'ko-KR',

  head: [
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUITE/fonts/variable/woff2/SUITE-Variable.css' }],
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/wan2land/d2coding/d2coding-ligature-full.css' }],
  ],

  themeConfig: {
    nav: [],

    sidebar: {
      // ── 2026 ──────────────────────────────────────────────
      '/2026/openstack-helm/': [
        {
          text: 'OpenStack Helm',
          items: [
            { text: 'Quick Guide', link: '/2026/openstack-helm/openstack-helm_quick_guide' },
            { text: 'Full Guide', link: '/2026/openstack-helm/openstack-helm_full_guide' },
            { text: '기타', link: '/2026/openstack-helm/openstack-helm_etc' },
          ],
        },
      ],
      '/2026/project-gamma/': [
        {
          text: 'Project Gamma (2026)',
          items: [
            { text: '개요', link: '/2026/project-gamma/' },
            { text: '아키텍처', link: '/2026/project-gamma/architecture' },
            { text: '트러블슈팅', link: '/2026/project-gamma/troubleshooting' },
          ],
        },
      ],

      // ── 2025 ──────────────────────────────────────────────
      '/2025/project-alpha/': [
        {
          text: 'Project Alpha v1',
          items: [
            { text: '개요', link: '/2025/project-alpha/' },
            { text: 'API 가이드', link: '/2025/project-alpha/api-guide' },
            { text: '아키텍처', link: '/2025/project-alpha/architecture' },
          ],
        },
      ],
      '/2025/project-alpha-v2/': [
        {
          text: 'Project Alpha v2',
          items: [
            { text: '개요', link: '/2025/project-alpha-v2/' },
            { text: 'API 가이드', link: '/2025/project-alpha-v2/api-guide' },
            { text: '아키텍처', link: '/2025/project-alpha-v2/architecture' },
            { text: 'GUI 가이드', link: '/2025/project-alpha-v2/gui-guide' },
            { text: '변경 이력', link: '/2025/project-alpha-v2/changelog' },
          ],
        },
      ],
      '/2025/project-beta/': [
        {
          text: 'Project Beta (2025)',
          items: [
            { text: '개요', link: '/2025/project-beta/' },
            { text: '설치', link: '/2025/project-beta/setup' },
          ],
        },
      ],
      '/2025/project-delta/': [
        {
          text: 'Project Delta (2025)',
          items: [
            { text: '개요', link: '/2025/project-delta/' },
          ],
        },
      ],

      // ── 2024 ──────────────────────────────────────────────
      '/2024/': [
        {
          text: '2024',
          items: [
            {
              text: 'Project Alpha',
              items: [
                { text: '개요', link: '/2024/project-alpha/' },
                { text: '아키텍처', link: '/2024/project-alpha/architecture' },
                { text: '설치', link: '/2024/project-alpha/setup' },
              ],
            },
            {
              text: 'Project Beta',
              items: [
                { text: '개요', link: '/2024/project-beta/' },
                { text: '아키텍처', link: '/2024/project-beta/architecture' },
                { text: '설치', link: '/2024/project-beta/setup' },
              ],
            },
            {
              text: 'Project Gamma',
              items: [
                { text: '개요', link: '/2024/project-gamma/' },
              ],
            },
          ],
        },
      ],

      // ── 2023 ──────────────────────────────────────────────
      '/2023/': [
        {
          text: '2023',
          items: [
            {
              text: 'Project Alpha',
              items: [
                { text: '개요', link: '/2023/project-alpha/' },
                { text: '아키텍처', link: '/2023/project-alpha/architecture' },
                { text: '설치', link: '/2023/project-alpha/setup' },
              ],
            },
            {
              text: 'Project Beta',
              items: [
                { text: '개요', link: '/2023/project-beta/' },
                { text: '아키텍처', link: '/2023/project-beta/architecture' },
                { text: '설치', link: '/2023/project-beta/setup' },
              ],
            },
            {
              text: 'Project Gamma',
              items: [
                { text: '개요', link: '/2023/project-gamma/' },
              ],
            },
          ],
        },
      ],

      // ── 2022 ──────────────────────────────────────────────
      '/2022/': [
        {
          text: '2022',
          items: [
            {
              text: 'Project Alpha',
              items: [
                { text: '개요', link: '/2022/project-alpha/' },
                { text: '아키텍처', link: '/2022/project-alpha/architecture' },
                { text: '설치', link: '/2022/project-alpha/setup' },
              ],
            },
            {
              text: 'Project Beta',
              items: [
                { text: '개요', link: '/2022/project-beta/' },
                { text: '아키텍처', link: '/2022/project-beta/architecture' },
                { text: '설치', link: '/2022/project-beta/setup' },
              ],
            },
            {
              text: 'Project Gamma',
              items: [
                { text: '개요', link: '/2022/project-gamma/' },
              ],
            },
          ],
        },
      ],

      // ── 2021 ──────────────────────────────────────────────
      '/2021/': [
        {
          text: '2021',
          items: [
            {
              text: 'Project Alpha',
              items: [
                { text: '개요', link: '/2021/project-alpha/' },
                { text: '아키텍처', link: '/2021/project-alpha/architecture' },
                { text: '설치', link: '/2021/project-alpha/setup' },
              ],
            },
            {
              text: 'Project Beta',
              items: [
                { text: '개요', link: '/2021/project-beta/' },
                { text: '아키텍처', link: '/2021/project-beta/architecture' },
                { text: '설치', link: '/2021/project-beta/setup' },
              ],
            },
          ],
        },
      ],

      // ── 2020 ──────────────────────────────────────────────
      '/2020/': [
        {
          text: '2020',
          items: [
            {
              text: 'Project Alpha',
              items: [
                { text: '개요', link: '/2020/project-alpha/' },
                { text: '아키텍처', link: '/2020/project-alpha/architecture' },
                { text: '설치', link: '/2020/project-alpha/setup' },
              ],
            },
            {
              text: 'Project Beta',
              items: [
                { text: '개요', link: '/2020/project-beta/' },
                { text: '아키텍처', link: '/2020/project-beta/architecture' },
                { text: '설치', link: '/2020/project-beta/setup' },
              ],
            },
          ],
        },
      ],

      // ── Guide ─────────────────────────────────────────────
      '/guide/': [
        {
          text: '가이드',
          items: [
            { text: '개요', link: '/guide/' },
            { text: '문서 관리', link: '/guide/docs-management' },
            { text: 'MDX 작성법', link: '/guide/mdx-writing' },
            { text: '컴포넌트', link: '/guide/components' },
            { text: '커스터마이징', link: '/guide/customization' },
          ],
        },
      ],
    },

    search: {
      provider: 'local'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cmaven' },
      {
        icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
        link: '/guide/',
        ariaLabel: 'Guide'
      }
    ],

    outline: {
      level: [2, 3],
      label: '목차'
    },

    darkModeSwitchLabel: '다크 모드',
    returnToTopLabel: '맨 위로',
    sidebarMenuLabel: '메뉴',
  },

  // 마이그레이션 중 콘텐츠 내 dead link 무시 (Phase 8 검증 시 재활성화 권장)
  ignoreDeadLinks: true,

  markdown: {
    lineNumbers: true,
  },

  vite: {
    server: {
      host: '0.0.0.0',
      port: 3030,
    }
  }
})
