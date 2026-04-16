/**
 * config.ts: cblogs 블로그 설정 - 포스트 자동 스캔 + 카테고리 집계
 * 상세: docs/posts/ 하위 md 파일을 스캔하여 blogPosts, blogCategories 생성
 * 생성일: 2026-04-13 | 수정일: 2026-04-13
 */
import { defineConfig } from 'vitepress'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const docsRoot = path.resolve(__dirname, '..')
const postsRoot = path.join(docsRoot, 'posts')

/** 카테고리 한글 매핑 */
const categoryLabels: Record<string, string> = {
  tech: '기술',
  life: '라이프',
  dev: '개발일지',
  linux: '리눅스',
}

const subcategoryLabels: Record<string, string> = {
  frontend: '프론트엔드',
  backend: '백엔드',
  ai: 'AI/ML',
  devops: 'DevOps',
  productivity: '생산성',
  review: '리뷰',
  travel: '여행',
  troubleshooting: '트러블슈팅',
  tooling: '도구',
  server: '서버',
}

interface BlogPost {
  title: string
  date: string
  category: string
  categoryLabel: string
  subcategory: string
  subcategoryLabel: string
  excerpt: string
  tags: string[]
  link: string
}

interface SubCategory {
  key: string
  label: string
  count: number
}

interface BlogCategory {
  key: string
  label: string
  count: number
  subcategories: SubCategory[]
}

/**
 * posts/ 디렉토리를 스캔하여 모든 블로그 포스트 메타데이터 수집
 */
function scanBlogPosts(): BlogPost[] {
  const posts: BlogPost[] = []

  if (!fs.existsSync(postsRoot)) return posts

  const categories = fs.readdirSync(postsRoot).filter(d =>
    fs.statSync(path.join(postsRoot, d)).isDirectory() && !d.startsWith('.')
  )

  for (const cat of categories) {
    const catPath = path.join(postsRoot, cat)
    const subcats = fs.readdirSync(catPath).filter(d =>
      fs.statSync(path.join(catPath, d)).isDirectory() && !d.startsWith('.')
    )

    for (const sub of subcats) {
      const subPath = path.join(catPath, sub)
      const files = fs.readdirSync(subPath).filter(f => f.endsWith('.md') && !f.startsWith('.'))

      for (const file of files) {
        const filePath = path.join(subPath, file)
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const { data } = matter(content)
          const slug = file.replace('.md', '')
          // YAML이 Date 객체로 파싱할 수 있으므로 ISO 문자열로 정규화 후 YYYY-MM-DD 추출
          let dateStr = '2026-01-01'
          if (data.date) {
            const parsed = new Date(data.date)
            dateStr = isNaN(parsed.getTime())
              ? String(data.date)
              : parsed.toISOString().split('T')[0]
          }
          posts.push({
            title: data.title || slug,
            date: dateStr,
            category: cat,
            categoryLabel: categoryLabels[cat] || cat,
            subcategory: sub,
            subcategoryLabel: subcategoryLabels[sub] || sub,
            excerpt: data.excerpt || '',
            tags: data.tags || [],
            link: `/posts/${cat}/${sub}/${slug}`,
          })
        } catch {}
      }
    }
  }

  // 날짜 역순 정렬
  posts.sort((a, b) => b.date.localeCompare(a.date))
  return posts
}

/**
 * 포스트 목록에서 카테고리 트리 생성
 */
function buildCategories(posts: BlogPost[]): BlogCategory[] {
  const catMap = new Map<string, { label: string; subMap: Map<string, { label: string; count: number }> }>()

  for (const post of posts) {
    if (!catMap.has(post.category)) {
      catMap.set(post.category, { label: post.categoryLabel, subMap: new Map() })
    }
    const cat = catMap.get(post.category)!
    if (!cat.subMap.has(post.subcategory)) {
      cat.subMap.set(post.subcategory, { label: post.subcategoryLabel, count: 0 })
    }
    cat.subMap.get(post.subcategory)!.count++
  }

  const result: BlogCategory[] = []
  for (const [key, val] of catMap) {
    const subcategories: SubCategory[] = []
    let totalCount = 0
    for (const [subKey, subVal] of val.subMap) {
      subcategories.push({ key: subKey, label: subVal.label, count: subVal.count })
      totalCount += subVal.count
    }
    result.push({ key, label: val.label, count: totalCount, subcategories })
  }

  return result
}

const blogPosts = scanBlogPosts()
const blogCategories = buildCategories(blogPosts)

// 배포 호스트네임 — User/Org Pages 배포 시 본인 GitHub 사용자명으로 치환
// 예: 'https://cmaven.github.io'
const SITE_HOSTNAME = 'https://YOUR_USERNAME.github.io'

// Cloudflare Web Analytics 토큰 — dash.cloudflare.com에서 발급 후 치환
// 비워두면 analytics 스크립트가 삽입되지 않음
const CF_ANALYTICS_TOKEN = 'YOUR_CF_TOKEN'

export default defineConfig({
  title: 'cblogs',
  description: '정보전달 블로그',
  lang: 'ko-KR',

  // 사이트맵 자동 생성 (구글 인덱싱용)
  sitemap: {
    hostname: SITE_HOSTNAME,
  },

  head: [
    // 파비콘
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],

    // 폰트
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUITE/fonts/variable/woff2/SUITE-Variable.css' }],
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/wan2land/d2coding/d2coding-ligature-full.css' }],

    // Open Graph 전역 기본값 (페이지별 og:title/description은 VitePress가 frontmatter에서 자동 생성)
    ['meta', { property: 'og:type', content: 'article' }],
    ['meta', { property: 'og:site_name', content: 'cblogs' }],
    ['meta', { property: 'og:locale', content: 'ko_KR' }],

    // Twitter Card
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],

    // Cloudflare Web Analytics (토큰이 설정된 경우에만 활성화)
    ...(CF_ANALYTICS_TOKEN && CF_ANALYTICS_TOKEN !== 'YOUR_CF_TOKEN' ? [
      ['script', {
        defer: '',
        src: 'https://static.cloudflareinsights.com/beacon.min.js',
        'data-cf-beacon': JSON.stringify({ token: CF_ANALYTICS_TOKEN }),
      }] as ['script', Record<string, string>],
    ] : []),

    // Google Search Console 인증 (HTML 태그 방식 사용 시 아래 주석 해제 후 토큰 입력)
    // ['meta', { name: 'google-site-verification', content: 'YOUR_GSC_TOKEN' }],
  ],

  themeConfig: {
    nav: [],
    sidebar: {},
    blogPosts,
    blogCategories,
    totalPostCount: blogPosts.length,

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: '목차'
    },

    darkModeSwitchLabel: '다크 모드',
    returnToTopLabel: '맨 위로',
    sidebarMenuLabel: '메뉴',
  },

  ignoreDeadLinks: true,

  markdown: {
    lineNumbers: false,
  },

  vite: {
    server: {
      host: '0.0.0.0',
      port: 3031,
    },
    plugins: [{
      name: 'auto-restart-on-new-posts',
      configureServer(server) {
        const watcher = server.watcher
        let restartTimer: ReturnType<typeof setTimeout> | null = null

        function scheduleRestart(reason: string) {
          console.log(`[auto-blog] ${reason}`)
          if (restartTimer) clearTimeout(restartTimer)
          restartTimer = setTimeout(() => {
            console.log('[auto-blog] 서버 재시작 중...')
            process.exit(0)
          }, 2000)
        }

        function isPostsPath(p: string) {
          return p.startsWith(postsRoot) && !p.includes('node_modules')
        }

        watcher.on('add', (p: string) => { if (p.endsWith('.md') && isPostsPath(p)) scheduleRestart(`새 포스트: ${p}`) })
        watcher.on('unlink', (p: string) => { if (p.endsWith('.md') && isPostsPath(p)) scheduleRestart(`포스트 삭제: ${p}`) })
        watcher.on('addDir', (p: string) => { if (isPostsPath(p)) scheduleRestart(`새 카테고리: ${p}`) })
        watcher.on('unlinkDir', (p: string) => { if (isPostsPath(p)) scheduleRestart(`카테고리 삭제: ${p}`) })
      }
    }]
  }
})
