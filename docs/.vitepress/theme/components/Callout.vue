<!--
  Callout.vue: VitePress custom-block 스타일 콜아웃 (Hint 별칭 포함)
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
const props = defineProps({
  type: { type: String, default: 'info' },
  title: String,
})

const typeMap = { info: 'info', warn: 'warning', warning: 'warning', error: 'danger', danger: 'danger', success: 'tip', tip: 'tip' }
const mappedType = typeMap[props.type] || 'info'
</script>

<template>
  <div :class="'custom-block ' + mappedType">
    <p v-if="title" class="custom-block-title">{{ title }}</p>
    <slot />
  </div>
</template>
