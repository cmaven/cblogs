<!--
  Details.vue: 접기/펼치기 details 블록 컴포넌트
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
import { ref } from 'vue'
const props = defineProps({ title: { type: String, required: true } })
const open = ref(false)
</script>

<template>
  <details class="custom-block details" @toggle="open = $event.target.open">
    <summary>{{ title }}</summary>
    <slot />
  </details>
</template>
