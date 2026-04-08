<!-- SidebarSearch.vue: 사이드바 내 검색 버튼 (Ctrl+K 트리거) | 생성일: 2026-04-08 -->
<script setup>
function openSearch() {
  const event = new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
    bubbles: true,
  })
  document.dispatchEvent(event)
}
</script>

<template>
  <div class="sidebar-search" @click="openSearch">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <span class="search-text">검색...</span>
    <kbd class="search-kbd">Ctrl+K</kbd>
  </div>
</template>

<style scoped>
.sidebar-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.6rem;
  margin: 0.25rem 0.5rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8rem;
  background: var(--vp-c-bg-soft);
}
.sidebar-search:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}
.search-text { flex: 1; }
.search-kbd {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}
</style>
