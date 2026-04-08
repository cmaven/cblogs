<!--
  Tab.vue: Tabs 컨테이너 내부의 개별 탭 패널 (value 기반 표시 제어)
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
import { inject, computed } from 'vue'

const props = defineProps({ value: { type: String, required: true } })
const activeTab = inject('activeTab')
// Parent items array를 읽지 못하므로 index 기반이 아닌 value 기반으로 처리
</script>

<template>
  <div v-show="$parent?.$props?.items?.indexOf(value) === activeTab" class="tab-panel">
    <slot />
  </div>
</template>
