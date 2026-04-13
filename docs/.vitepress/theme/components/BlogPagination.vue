<!--
  BlogPagination.vue: 페이지네이션 컴포넌트
  생성일: 2026-04-13 | 수정일: 2026-04-13
-->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentPage: { type: Number, required: true },
  totalPages: { type: Number, required: true },
})

const emit = defineEmits(['page-change'])

const pages = computed(() => {
  const result = []
  const total = props.totalPages
  const current = props.currentPage

  if (total <= 7) {
    for (let i = 1; i <= total; i++) result.push(i)
  } else {
    result.push(1)
    if (current > 3) result.push('...')
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) result.push(i)
    if (current < total - 2) result.push('...')
    result.push(total)
  }

  return result
})

function goToPage(page) {
  if (typeof page === 'number' && page !== props.currentPage) {
    emit('page-change', page)
  }
}
</script>

<template>
  <nav v-if="totalPages > 1" class="pagination">
    <button
      class="page-btn prev"
      :disabled="currentPage === 1"
      @click="goToPage(currentPage - 1)"
    >
      &laquo; 이전
    </button>

    <template v-for="(page, idx) in pages" :key="idx">
      <span v-if="page === '...'" class="page-ellipsis">...</span>
      <button
        v-else
        class="page-btn"
        :class="{ active: page === currentPage }"
        @click="goToPage(page)"
      >
        {{ page }}
      </button>
    </template>

    <button
      class="page-btn next"
      :disabled="currentPage === totalPages"
      @click="goToPage(currentPage + 1)"
    >
      다음 &raquo;
    </button>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.35rem;
  margin-top: 2rem;
  padding: 1rem 0;
}
.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 0.6rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}
.page-btn:hover:not(:disabled):not(.active) {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.page-btn.active {
  background: var(--vp-c-brand-1);
  color: #fff;
  border-color: var(--vp-c-brand-1);
  font-weight: 600;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.page-btn.prev,
.page-btn.next {
  font-size: 0.8rem;
  font-weight: 500;
}
.page-ellipsis {
  color: var(--vp-c-text-3);
  padding: 0 0.25rem;
}
</style>
