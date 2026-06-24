<!--
  CustomLayout.vue: cblogs 블로그 레이아웃 - 홈/포스트 모두 BlogSidebar 노출
  생성일: 2026-04-13 | 수정일: 2026-04-16
-->
<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData, useRouter, useRoute } from 'vitepress'
import { computed, ref, watch } from 'vue'
import BlogHome from './BlogHome.vue'
import BlogSidebar from './BlogSidebar.vue'
import Giscus from './Giscus.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const router = useRouter()
const route = useRoute()

const isHome = computed(() =>
  frontmatter.value.layout === 'home' || frontmatter.value.layout === 'page'
)

// 좁은 화면(≤768px) 사이드바 드로어 열림 상태
const sidebarOpen = ref(false)
// 페이지 이동 시 드로어 자동 닫힘
watch(() => route.path, () => { sidebarOpen.value = false })

// 포스트 페이지 사이드바에서 카테고리 선택 시 홈으로 이동하며 필터 복원
function onSidebarSelect(cat, sub) {
  sidebarOpen.value = false
  const params = new URLSearchParams()
  if (cat) params.set('cat', cat)
  if (sub) params.set('sub', sub)
  const q = params.toString()
  router.go(`/${q ? '?' + q : ''}`)
}
</script>

<template>
  <BlogHome v-if="isHome" />
  <div v-else class="cblogs-post-wrapper" :class="{ 'sidebar-open': sidebarOpen }">
    <!-- 모바일 햄버거 토글 (≤768px에서만 표시) -->
    <button class="cblogs-menu-toggle" aria-label="메뉴 열기" @click="sidebarOpen = true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>

    <!-- 드로어 백드롭 -->
    <div v-if="sidebarOpen" class="cblogs-sidebar-backdrop" @click="sidebarOpen = false"></div>

    <BlogSidebar :open="sidebarOpen" @select="onSidebarSelect" />
    <Layout>
      <template #doc-after>
        <Giscus />
      </template>
    </Layout>
  </div>
</template>

<style>
/* 포스트 페이지: VitePress top nav 완전 숨김 (BlogSidebar에 검색/다크모드 모두 포함됨) */
.cblogs-post-wrapper .VPNav,
.cblogs-post-wrapper .VPLocalNav {
  display: none !important;
}
/* BlogSidebar(280px) 너비만큼 본문 오프셋 + 상단 padding 제거 */
.cblogs-post-wrapper .VPContent {
  padding-left: 280px !important;
  padding-top: 0 !important;
}
@media (max-width: 768px) {
  .cblogs-post-wrapper .VPContent {
    padding-left: 0 !important;
  }
}

/* 햄버거 토글: 데스크톱 숨김, ≤768px에서만 표시 */
.cblogs-menu-toggle {
  display: none;
  position: fixed;
  top: 0.6rem;
  left: 0.6rem;
  z-index: 52;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-sidebar-bg-color, #fff);
  color: var(--vp-c-text-1);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.cblogs-menu-toggle:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
/* 드로어 백드롭 */
.cblogs-sidebar-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .cblogs-menu-toggle {
    display: inline-flex;
  }
  /* 드로어 열렸을 땐 토글을 숨겨(사이드바에 가림) 중복 노출 방지 */
  .cblogs-post-wrapper.sidebar-open .cblogs-menu-toggle {
    display: none;
  }
  .cblogs-sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 49;
    background: rgba(0, 0, 0, 0.4);
  }
}
</style>
