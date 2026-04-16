<!--
  DateTracker.vue: 현재 날짜/시간 실시간 위젯
  생성일: 2026-04-13 | 수정일: 2026-04-13
-->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const now = ref(new Date())
let timer = null

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(d) {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dayName = dayNames[d.getDay()]
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const sec = String(d.getSeconds()).padStart(2, '0')
  return { date: `${y}년 ${m}월 ${day}일 (${dayName})`, time: `${h}:${min}:${sec}` }
}

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="date-tracker">
    <h3 class="tracker-title">오늘</h3>
    <div class="tracker-content">
      <div class="tracker-date">{{ formatDate(now).date }}</div>
      <div class="tracker-time">{{ formatDate(now).time }}</div>
    </div>
  </div>
</template>

<style scoped>
.date-tracker {
  padding: 0.4rem 0.6rem;
  margin: 0.5rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}
.tracker-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.2rem;
}
.tracker-content {
  text-align: center;
}
.tracker-date {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.tracker-time {
  font-size: 1rem;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  margin-top: 0.05rem;
}
</style>
