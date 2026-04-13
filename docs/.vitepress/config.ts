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
}

const subcategoryLabels: Record<string, string> = {
  frontend: '프론트엔드',
  backend: '백엔드',
  productivity: '생산성',
  review: '리뷰',
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
          posts.push({
            title: data.title || slug,
            date: data.date ? String(data.date).split('T')[0] : '2026-01-01',
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

export default defineConfig({
  title: 'cblogs',
  description: '정보전달 블로그',
  lang: 'ko-KR',

  head: [
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUITE/fonts/variable/woff2/SUITE-Variable.css' }],
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/wan2land/d2coding/d2coding-ligature-full.css' }],
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
