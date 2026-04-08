<!--
  Badge.vue: 9가지 스타일을 지원하는 인라인 배지 컴포넌트
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'

const props = defineProps({
  style: { type: String, default: 'default' },
  title: String,
  value: String,
})

const { isDark } = useData()

const lightColors = {
  info: { bg: '#dbeafe', border: '#3b82f6', text: '#ffffff' },
  success: { bg: '#d1fae5', border: '#10b981', text: '#ffffff' },
  warning: { bg: '#fef3c7', border: '#d97706', text: '#ffffff' },
  danger: { bg: '#fee2e2', border: '#ef4444', text: '#ffffff' },
  note: { bg: '#e0e7ff', border: '#6366f1', text: '#ffffff' },
  tip: { bg: '#d1fae5', border: '#10b981', text: '#ffffff' },
  important: { bg: '#ede9fe', border: '#8b5cf6', text: '#ffffff' },
  caution: { bg: '#fff7ed', border: '#f97316', text: '#ffffff' },
  default: { bg: '#f3f4f6', border: '#6b7280', text: '#ffffff' },
}

const darkColors = {
  info: { bg: '#1e3a5f', border: '#60a5fa', text: '#ffffff' },
  success: { bg: '#064e3b', border: '#34d399', text: '#ffffff' },
  warning: { bg: '#451a03', border: '#fbbf24', text: '#1a1a1a' },
  danger: { bg: '#450a0a', border: '#f87171', text: '#ffffff' },
  note: { bg: '#1e1b4b', border: '#818cf8', text: '#ffffff' },
  tip: { bg: '#064e3b', border: '#34d399', text: '#ffffff' },
  important: { bg: '#2e1065', border: '#a78bfa', text: '#ffffff' },
  caution: { bg: '#431407', border: '#fb923c', text: '#1a1a1a' },
  default: { bg: '#374151', border: '#9ca3af', text: '#ffffff' },
}

const colors = computed(() => {
  const map = isDark.value ? darkColors : lightColors
  return map[props.style] || map.default
})
</script>

<template>
  <span class="mdx-badge" :style="{
    display: 'inline-flex',
    alignItems: 'stretch',
    fontSize: '0.8rem',
    fontWeight: 500,
    borderRadius: '6px',
    border: '1px solid ' + colors.border,
    overflow: 'hidden',
    lineHeight: 1,
    verticalAlign: 'middle',
  }">
    <span v-if="title" :style="{ padding: '4px 8px', backgroundColor: colors.bg, display: 'inline-flex', alignItems: 'center' }">{{ title }}</span>
    <span v-if="value" :style="{ padding: '4px 8px', backgroundColor: colors.border, color: colors.text, display: 'inline-flex', alignItems: 'center' }">{{ value }}</span>
    <span v-if="$slots.default" :style="{ padding: '4px 8px', backgroundColor: colors.border, color: colors.text, display: 'inline-flex', alignItems: 'center' }"><slot /></span>
  </span>
</template>
