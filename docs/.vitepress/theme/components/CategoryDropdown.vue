<!-- CategoryDropdown.vue: 연도/카테고리 선택 커스텀 드롭다운 | 생성일: 2026-04-08 | 수정일: 2026-04-09 -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, useData } from 'vitepress'

const route = useRoute()
const router = useRouter()
const { theme } = useData()
const isOpen = ref(false)
const dropdownRef = ref(null)

// themeConfig.categories에서 자동 생성된 목록 사용
const categories = computed(() => theme.value.categories || [])

const currentCategory = computed(() => {
  const path = route.path
  for (const cat of categories.value) {
    if (cat.label === 'Guide' && path.startsWith('/guide')) return cat.label
    if (path.startsWith('/' + cat.label + '/')) return cat.label
  }
  return categories.value[0]?.label || ''
})

function toggle() {
  isOpen.value = !isOpen.value
}

function select(cat) {
  isOpen.value = false
  router.go(cat.path)
}

function onClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div class="category-dropdown" ref="dropdownRef">
    <button class="dropdown-trigger" @click="toggle" :class="{ open: isOpen }">
      <span>{{ currentCategory }}</span>
      <svg class="chevron" :class="{ rotated: isOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>
    <Transition name="dropdown">
      <ul v-if="isOpen" class="dropdown-list">
        <li
          v-for="cat in categories"
          :key="cat.label"
          :class="{ active: cat.label === currentCategory }"
          @click="select(cat)"
        >
          {{ cat.label }}
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.category-dropdown {
  position: relative;
  padding: 0.25rem 0.5rem;
  margin-bottom: 0.25rem;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}
.dropdown-trigger:hover,
.dropdown-trigger.open {
  border-color: var(--vp-c-brand-1);
  background-color: var(--vp-c-bg-elv);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}

.chevron {
  transition: transform 0.2s;
}
.chevron.rotated {
  transform: rotate(180deg);
}

.dropdown-list {
  position: absolute;
  left: 0.5rem;
  right: 0.5rem;
  top: calc(100% + 2px);
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 280px;
  overflow-y: auto;
}

.dropdown-list li {
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  font-family: var(--vp-font-family-base);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: all 0.15s;
}
.dropdown-list li:hover {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.dropdown-list li.active {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 700;
}

/* 드롭다운 애니메이션 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
