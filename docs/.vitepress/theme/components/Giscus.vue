<!--
  Giscus.vue: GitHub Discussions 기반 댓글 위젯 (다크모드 자동 동기화)
  상세: 포스트 페이지 하단에 노출, isDark 변경 시 테마 재로드
  생성일: 2026-04-16 | 수정일: 2026-04-16
-->
<script setup>
import { onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'

const { isDark } = useData()
const route = useRoute()
const container = ref(null)

// 사용자가 giscus.app에서 발급받은 4개 ID로 치환 필요
const GISCUS_CONFIG = {
  repo: 'YOUR_USERNAME/YOUR_REPO',          // 예: cmaven/cmaven.github.io
  repoId: 'YOUR_REPO_ID',                   // R_xxx...
  category: 'Announcements',                 // 또는 General 등
  categoryId: 'YOUR_CATEGORY_ID',           // DIC_xxx...
  mapping: 'pathname',                       // URL pathname 기반 매핑
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'bottom',
  lang: 'ko',
}

function load() {
  if (!container.value) return
  // 기존 Giscus iframe 제거 후 재로드
  container.value.innerHTML = ''
  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.setAttribute('data-repo', GISCUS_CONFIG.repo)
  script.setAttribute('data-repo-id', GISCUS_CONFIG.repoId)
  script.setAttribute('data-category', GISCUS_CONFIG.category)
  script.setAttribute('data-category-id', GISCUS_CONFIG.categoryId)
  script.setAttribute('data-mapping', GISCUS_CONFIG.mapping)
  script.setAttribute('data-reactions-enabled', GISCUS_CONFIG.reactionsEnabled)
  script.setAttribute('data-emit-metadata', GISCUS_CONFIG.emitMetadata)
  script.setAttribute('data-input-position', GISCUS_CONFIG.inputPosition)
  script.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  script.setAttribute('data-lang', GISCUS_CONFIG.lang)
  script.crossOrigin = 'anonymous'
  script.async = true
  container.value.appendChild(script)
}

// 마운트 시 + 다크모드 변경 시 + 라우트 변경 시 재로드
onMounted(load)
watch(isDark, load)
watch(() => route.path, load)
</script>

<template>
  <div class="giscus-section">
    <h2 class="giscus-title">댓글</h2>
    <div ref="container" class="giscus-container" />
  </div>
</template>

<style scoped>
.giscus-section {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
}
.giscus-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
}
.giscus-container {
  min-height: 200px;
}
</style>
