<!--
  Steps.vue: CSS counter 기반 순서있는 단계 목록 컨테이너
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<template>
  <div class="vp-steps">
    <slot />
  </div>
</template>

<style scoped>
.vp-steps { counter-reset: step; padding-left: 2rem; position: relative; }
.vp-steps::before { content: ''; position: absolute; left: 0.75rem; top: 0; bottom: 0; width: 2px; background: var(--vp-c-border); }
</style>
