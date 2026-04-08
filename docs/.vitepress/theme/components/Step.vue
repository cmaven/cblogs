<!--
  Step.vue: Steps 컨테이너 내부의 개별 단계 아이템
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<template>
  <div class="vp-step">
    <slot />
  </div>
</template>

<style scoped>
.vp-step { counter-increment: step; position: relative; padding-bottom: 1.5rem; }
.vp-step::before {
  content: counter(step);
  position: absolute;
  left: -2rem;
  top: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
</style>
