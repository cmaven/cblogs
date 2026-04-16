<!--
  CustomLayout.vue: cblogs 블로그 레이아웃 - 홈/포스트 모두 BlogSidebar 노출
  생성일: 2026-04-13 | 수정일: 2026-04-16
-->
<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData, useRouter } from 'vitepress'
import { computed } from 'vue'
import BlogHome from './BlogHome.vue'
import BlogSidebar from './BlogSidebar.vue'
import Giscus from './Giscus.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const router = useRouter()

const isHome = computed(() =>
  frontmatter.value.layout === 'home' || frontmatter.value.layout === 'page'
)

// 포스트 페이지 사이드바에서 카테고리 선택 시 홈으로 이동하며 필터 복원
function onSidebarSelect(cat, sub) {
  const params = new URLSearchParams()
  if (cat) params.set('cat', cat)
  if (sub) params.set('sub', sub)
  const q = params.toString()
  router.go(`/${q ? '?' + q : ''}`)
}
</script>

<template>
  <BlogHome v-if="isHome" />
  <div v-else class="cblogs-post-wrapper">
    <BlogSidebar @select="onSidebarSelect" />
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
</style>
