<!--
  Button.vue: outline/solid 두 가지 변형을 지원하는 링크 버튼 컴포넌트
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  href: { type: String, required: true },
  variant: { type: String, default: 'outline' },
})

const isExternal = computed(() => props.href.startsWith('http://') || props.href.startsWith('https://'))
</script>

<template>
  <a :href="href" :class="'mdx-button mdx-button--' + variant" :target="isExternal ? '_blank' : undefined" :rel="isExternal ? 'noopener noreferrer' : undefined">
    <slot />
    <svg v-if="isExternal" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px; display: inline-block; vertical-align: middle;">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  </a>
</template>
