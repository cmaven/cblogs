<!-- DocHeader.vue: 문서 상단 프로젝트 라벨 + 제목 + 설명 (frontmatter 자동 렌더링) | 생성일: 2026-04-09 -->
<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter, page } = useData()

const projectLabel = computed(() => {
  const path = page.value.relativePath
  // 경로에서 프로젝트명 추출: 2025/project-alpha/index.md → Project Alpha
  const match = path.match(/\d{4}\/([\w-]+)/)
  if (!match) return null
  return match[1]
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
})

const title = computed(() => frontmatter.value.title || '')
const description = computed(() => frontmatter.value.description || '')
const showHeader = computed(() => title.value && projectLabel.value)
</script>

<template>
  <div v-if="showHeader" class="doc-header">
    <span class="doc-label">{{ projectLabel }}</span>
    <h1 class="doc-title">{{ title }}</h1>
    <p v-if="description" class="doc-description">{{ description }}</p>
  </div>
</template>

<style scoped>
.doc-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--vp-c-border);
}
.doc-label {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  margin-bottom: 0.25rem;
}
.doc-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  line-height: 1.3;
  margin: 0;
  border: none;
  padding: 0;
}
.doc-description {
  font-size: 0.95rem;
  color: var(--vp-c-text-2);
  margin: 0.5rem 0 0;
}
</style>
