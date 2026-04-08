<!--
  Tabs.vue: 클릭 전환 탭 컨테이너, items 배열로 탭 헤더 구성
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
import { ref, provide } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

const activeIndex = ref(0)
provide('activeTab', activeIndex)
</script>

<template>
  <div class="vp-tabs">
    <div class="tabs-header" role="tablist">
      <button
        v-for="(item, i) in items"
        :key="i"
        role="tab"
        :aria-selected="activeIndex === i"
        :class="['tab-btn', { active: activeIndex === i }]"
        @click="activeIndex = i"
      >
        {{ item }}
      </button>
    </div>
    <div class="tabs-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.vp-tabs { margin: 1rem 0; border: 1px solid var(--vp-c-border); border-radius: 8px; overflow: hidden; }
.tabs-header { display: flex; background: var(--vp-c-bg-soft); border-bottom: 1px solid var(--vp-c-border); }
.tab-btn { padding: 0.5rem 1rem; border: none; background: none; cursor: pointer; font-size: 0.875rem; color: var(--vp-c-text-2); transition: all 0.2s; }
.tab-btn.active { color: var(--vp-c-brand-1); border-bottom: 2px solid var(--vp-c-brand-1); background: var(--vp-c-bg); }
.tab-btn:hover:not(.active) { color: var(--vp-c-text-1); }
.tabs-content { padding: 1rem; }
</style>
