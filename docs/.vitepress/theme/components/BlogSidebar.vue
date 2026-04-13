<!--
  BlogSidebar.vue: 블로그 전용 사이드바 컨테이너
  상세: 블로그 제목, 카테고리 트리, 날짜 트래커, 방문자 카운터, 다크모드 토글
  생성일: 2026-04-13 | 수정일: 2026-04-13
-->
<script setup>
import { useData } from 'vitepress'
import CategoryTree from './CategoryTree.vue'
import DateTracker from './DateTracker.vue'
import VisitorCounter from './VisitorCounter.vue'

const { isDark } = useData()

const props = defineProps({
  selectedCategory: { type: String, default: '' },
  selectedSubcategory: { type: String, default: '' },
})

const emit = defineEmits(['select'])

function onCategorySelect(cat, sub) {
  emit('select', cat, sub)
}

function toggleDark() {
  isDark.value = !isDark.value
}

function openSearch() {
  const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
  document.dispatchEvent(event)
}
</script>

<template>
  <aside class="blog-sidebar">
    <div class="sidebar-inner">
      <!-- 블로그 제목 -->
      <div class="sidebar-header">
        <a href="/" class="blog-title">cblogs</a>
        <p class="blog-subtitle">정보전달 블로그</p>
      </div>

      <div class="sidebar-divider"></div>

      <!-- 카테고리 트리 -->
      <CategoryTree
        :selected-category="selectedCategory"
        :selected-subcategory="selectedSubcategory"
        @select="onCategorySelect"
      />

      <div class="sidebar-divider"></div>

      <!-- 날짜 트래커 -->
      <DateTracker />

      <!-- 방문자 카운터 -->
      <VisitorCounter />
    </div>

    <!-- 사이드바 푸터 (하단 고정) -->
    <div class="sidebar-footer">
      <!-- 검색 -->
      <div class="footer-search" @click="openSearch">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span class="search-text">검색...</span>
        <kbd class="search-kbd">Ctrl+K</kbd>
      </div>

      <!-- 아이콘 -->
      <div class="footer-icons">
        <button @click="toggleDark" class="footer-icon" :title="isDark ? 'Light mode' : 'Dark mode'">
          <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>

        <a href="https://github.com/cmaven" target="_blank" rel="noopener noreferrer" class="footer-icon" title="GitHub">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.blog-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  background: var(--vp-sidebar-bg-color, #fff);
  border-right: 1px solid var(--vp-c-border);
  overflow-y: auto;
  z-index: 50;
  display: flex;
  flex-direction: column;
}
.sidebar-inner {
  padding: 0.5rem 0;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 5.5rem;
}
.sidebar-header {
  padding: 1rem 1rem 0.5rem;
}
.blog-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  display: block;
}
.blog-title:hover {
  opacity: 0.8;
}
.blog-subtitle {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  margin: 0.15rem 0 0;
}
.sidebar-divider {
  height: 1px;
  background: var(--vp-c-border);
  margin: 0.5rem 0.75rem;
}

/* 사이드바 푸터 (하단 고정) */
.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid var(--vp-c-border);
  position: fixed;
  bottom: 0;
  left: 0;
  width: 280px;
  background: var(--vp-sidebar-bg-color, #ffffff);
  z-index: 51;
  box-sizing: border-box;
}
.footer-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8rem;
  background: rgba(234, 233, 239, 0.18);
}
.footer-search:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}
.search-text { flex: 1; }
.search-kbd {
  font-size: 0.65rem;
  padding: 0.1rem 0.35rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}
.footer-icons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.footer-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: all 0.2s;
  background: none;
  border: none;
  text-decoration: none;
}
.footer-icon:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
</style>
