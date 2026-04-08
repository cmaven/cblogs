<!-- CustomLayout.vue: VitePress DefaultTheme 확장 레이아웃 | 수정일: 2026-04-08 -->
<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData, useRoute } from 'vitepress'
import { watchEffect, onUnmounted } from 'vue'
import CategoryDropdown from './CategoryDropdown.vue'
import SidebarFooter from './SidebarFooter.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const route = useRoute()

watchEffect(() => {
  const isHome = frontmatter.value.layout === 'home' || frontmatter.value.layout === 'page'
  if (!isHome && typeof document !== 'undefined') {
    document.body.classList.add('hide-navbar')
  } else if (typeof document !== 'undefined') {
    document.body.classList.remove('hide-navbar')
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.classList.remove('hide-navbar')
  }
})
</script>

<template>
  <Layout>
    <template #sidebar-nav-before>
      <a href="/" class="sidebar-title">Tech Docs Portal</a>
      <CategoryDropdown />
    </template>
    <template #sidebar-nav-after>
      <SidebarFooter />
    </template>
  </Layout>
</template>
