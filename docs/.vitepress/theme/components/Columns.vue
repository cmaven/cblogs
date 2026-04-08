<!--
  Columns.vue: flex 기반 다중 컬럼 레이아웃 컨테이너
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
defineProps({ ratio: String })
</script>

<template>
  <div class="mdx-columns">
    <slot />
  </div>
</template>
