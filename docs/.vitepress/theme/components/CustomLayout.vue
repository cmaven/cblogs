<!--
  CustomLayout.vue: cblogs 블로그 레이아웃 - 홈은 BlogHome, 포스트는 기본 doc 레이아웃
  생성일: 2026-04-13 | 수정일: 2026-04-13
-->
<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { computed } from 'vue'
import BlogHome from './BlogHome.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()

const isHome = computed(() =>
  frontmatter.value.layout === 'home' || frontmatter.value.layout === 'page'
)
</script>

<template>
  <BlogHome v-if="isHome" />
  <Layout v-else>
    <template #sidebar-nav-before>
      <div class="sidebar-header">
        <a href="/" class="sidebar-title">cblogs</a>
      </div>
    </template>
  </Layout>
</template>

<style scoped>
.sidebar-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--vp-c-border);
}
.sidebar-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.sidebar-title:hover {
  opacity: 0.8;
}
</style>
