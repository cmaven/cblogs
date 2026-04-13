<!--
  VisitorCounter.vue: 오늘/전체 방문자 카운터 (localStorage 기반)
  생성일: 2026-04-13 | 수정일: 2026-04-13
-->
<script setup>
import { ref, onMounted } from 'vue'

const todayCount = ref(0)
const totalCount = ref(0)

function getTodayKey() {
  const d = new Date()
  return `cblogs_visit_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

onMounted(() => {
  if (typeof localStorage === 'undefined') return

  const todayKey = getTodayKey()
  const sessionKey = 'cblogs_session'
  const totalKey = 'cblogs_total_visits'

  // 전체 방문자 수
  totalCount.value = parseInt(localStorage.getItem(totalKey) || '0', 10)

  // 오늘 방문자 수
  todayCount.value = parseInt(localStorage.getItem(todayKey) || '0', 10)

  // 현재 세션에서 아직 카운팅하지 않은 경우에만 증가
  const lastSession = sessionStorage.getItem(sessionKey)
  if (lastSession !== todayKey) {
    todayCount.value++
    totalCount.value++
    localStorage.setItem(todayKey, String(todayCount.value))
    localStorage.setItem(totalKey, String(totalCount.value))
    sessionStorage.setItem(sessionKey, todayKey)
  }
})
</script>

<template>
  <div class="visitor-counter">
    <h3 class="counter-title">방문자</h3>
    <div class="counter-grid">
      <div class="counter-item">
        <span class="counter-label">오늘</span>
        <span class="counter-value">{{ todayCount }}</span>
      </div>
      <div class="counter-item">
        <span class="counter-label">전체</span>
        <span class="counter-value total">{{ totalCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.visitor-counter {
  padding: 0.75rem;
  margin: 0.5rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}
.counter-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem;
}
.counter-grid {
  display: flex;
  gap: 0.75rem;
}
.counter-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem;
  background: var(--vp-c-bg-elv);
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
}
.counter-label {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  font-weight: 500;
}
.counter-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
}
.counter-value.total {
  color: var(--vp-c-text-1);
}
</style>
