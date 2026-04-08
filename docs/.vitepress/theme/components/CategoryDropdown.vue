<!-- CategoryDropdown.vue: 연도/카테고리 선택 드롭다운 | 생성일: 2026-04-08 -->
<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vitepress'

const route = useRoute()
const router = useRouter()

const categories = [
  { label: '2026', path: '/2026/openstack-helm/openstack-helm_quick_guide' },
  { label: '2025', path: '/2025/project-alpha/' },
  { label: '2024', path: '/2024/project-alpha/' },
  { label: '2023', path: '/2023/project-alpha/' },
  { label: '2022', path: '/2022/project-alpha/' },
  { label: '2021', path: '/2021/project-alpha/' },
  { label: '2020', path: '/2020/project-alpha/' },
  { label: 'Guide', path: '/guide/' },
]

const currentCategory = computed(() => {
  const path = route.path
  for (const cat of categories) {
    if (cat.label === 'Guide' && path.startsWith('/guide')) return cat.label
    if (path.startsWith('/' + cat.label + '/')) return cat.label
  }
  return categories[0].label
})

function onChange(event) {
  const selected = categories.find(c => c.label === event.target.value)
  if (selected) {
    router.go(selected.path)
  }
}
</script>

<template>
  <div class="category-dropdown">
    <select :value="currentCategory" @change="onChange" class="category-select">
      <option v-for="cat in categories" :key="cat.label" :value="cat.label">
        {{ cat.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.category-dropdown {
  padding: 0.25rem 0.5rem;
  margin-bottom: 0.25rem;
}
.category-select {
  width: 100%;
  padding: 0.35rem 2.25rem 0.35rem 0.6rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7a77' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 0.875rem;
  transition: all 0.2s;
}
.category-select:hover,
.category-select:focus {
  border-color: var(--vp-c-brand-1);
  background-color: var(--vp-c-bg-elv);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}
</style>
