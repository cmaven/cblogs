<!--
  CategoryTree.vue: 카테고리 트리 - 전체보기(N) + 대분류 > 소분류(N)
  생성일: 2026-04-13 | 수정일: 2026-04-13
-->
<script setup>
import { ref, computed } from 'vue'
import { useData } from 'vitepress'

const props = defineProps({
  selectedCategory: { type: String, default: '' },
  selectedSubcategory: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const { theme } = useData()
const categories = computed(() => theme.value.blogCategories || [])
const totalCount = computed(() => theme.value.totalPostCount || 0)

const expandedCats = ref(new Set())

function toggleCat(catKey) {
  if (expandedCats.value.has(catKey)) {
    expandedCats.value.delete(catKey)
  } else {
    expandedCats.value.add(catKey)
  }
}

function selectAll() {
  emit('select', '', '')
}

function selectCategory(catKey) {
  emit('select', catKey, '')
}

function selectSubcategory(catKey, subKey) {
  emit('select', catKey, subKey)
}

function isActive(cat, sub) {
  if (!cat && !sub) return !props.selectedCategory && !props.selectedSubcategory
  if (cat && !sub) return props.selectedCategory === cat && !props.selectedSubcategory
  return props.selectedCategory === cat && props.selectedSubcategory === sub
}
</script>

<template>
  <div class="category-tree">
    <h3 class="tree-title">카테고리</h3>
    <ul class="tree-list">
      <li
        class="tree-item all"
        :class="{ active: isActive('', '') }"
        @click="selectAll"
      >
        <span class="item-label">전체보기</span>
        <span class="item-count">{{ totalCount }}</span>
      </li>
      <li v-for="cat in categories" :key="cat.key" class="tree-group">
        <div
          class="tree-item major"
          :class="{ active: isActive(cat.key, ''), expanded: expandedCats.has(cat.key) }"
          @click="toggleCat(cat.key); selectCategory(cat.key)"
        >
          <span class="expand-icon">{{ expandedCats.has(cat.key) ? '▾' : '▸' }}</span>
          <span class="item-label">{{ cat.label }}</span>
          <span class="item-count">{{ cat.count }}</span>
        </div>
        <ul v-show="expandedCats.has(cat.key)" class="sub-list">
          <li
            v-for="sub in cat.subcategories"
            :key="sub.key"
            class="tree-item minor"
            :class="{ active: isActive(cat.key, sub.key) }"
            @click.stop="selectSubcategory(cat.key, sub.key)"
          >
            <span class="item-label">{{ sub.label }}</span>
            <span class="item-count">{{ sub.count }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.category-tree {
  padding: 0.75rem 0;
}
.tree-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem;
  padding: 0 0.75rem;
}
.tree-list, .sub-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tree-item {
  display: flex;
  align-items: center;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--vp-c-text-1);
  transition: all 0.15s;
  border-radius: 6px;
  margin: 1px 0.5rem;
}
.tree-item:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-brand-1);
}
.tree-item.active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
.tree-item.minor {
  padding-left: 2rem;
  font-size: 0.825rem;
}
.expand-icon {
  font-size: 0.7rem;
  margin-right: 0.35rem;
  color: var(--vp-c-text-3);
  width: 0.75rem;
}
.item-label {
  flex: 1;
}
.item-count {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  min-width: 1.5rem;
  text-align: center;
}
.tree-item.active .item-count {
  background: var(--vp-c-brand-1);
  color: #fff;
}
</style>
