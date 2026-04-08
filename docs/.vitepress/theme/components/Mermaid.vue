<!--
  Mermaid.vue: Mermaid 다이어그램 렌더링 컴포넌트
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
import { ref, onMounted, watch } from 'vue'
import { useData } from 'vitepress'

const props = defineProps({ chart: { type: String, required: true } })
const container = ref(null)
const { isDark } = useData()

async function render() {
  if (!container.value) return
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    fontFamily: 'inherit',
    theme: isDark.value ? 'dark' : 'default',
  })
  const id = 'mermaid-' + Math.random().toString(36).slice(2)
  try {
    const { svg } = await mermaid.render(id, props.chart.replaceAll('\\n', '\n'))
    container.value.innerHTML = svg
  } catch {
    container.value.innerHTML = '<pre style="color:red">Mermaid 렌더링 실패</pre>'
  }
}

onMounted(render)
watch(isDark, render)
</script>

<template>
  <div class="my-6 flex justify-center overflow-x-auto rounded-lg border p-4" style="border-color: var(--vp-c-border); background: var(--vp-c-bg-elv);">
    <div ref="container" class="mermaid-wrapper" />
  </div>
</template>
