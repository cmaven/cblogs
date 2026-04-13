<!--
  BlogPostCard.vue: 블로그 포스트 카드 컴포넌트
  생성일: 2026-04-13 | 수정일: 2026-04-13
-->
<script setup>
defineProps({
  title: { type: String, required: true },
  date: { type: String, required: true },
  categoryLabel: { type: String, default: '' },
  subcategoryLabel: { type: String, default: '' },
  excerpt: { type: String, default: '' },
  tags: { type: Array, default: () => [] },
  link: { type: String, required: true },
})
</script>

<template>
  <a :href="link" class="post-card">
    <div class="card-meta">
      <span class="card-date">{{ date }}</span>
      <span class="card-category">{{ categoryLabel }} &gt; {{ subcategoryLabel }}</span>
    </div>
    <h3 class="card-title">{{ title }}</h3>
    <p v-if="excerpt" class="card-excerpt">{{ excerpt }}</p>
    <div v-if="tags.length" class="card-tags">
      <span v-for="tag in tags" :key="tag" class="card-tag">#{{ tag }}</span>
    </div>
  </a>
</template>

<style scoped>
.post-card {
  display: block;
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--vp-c-border);
  text-decoration: none;
  color: var(--vp-c-text-1);
  transition: all 0.2s;
  background: var(--vp-c-bg-elv);
}
.post-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.card-date {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}
.card-category {
  font-size: 0.75rem;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 0.1rem 0.5rem;
  border-radius: 10px;
  font-weight: 500;
}
.card-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 0.4rem;
  line-height: 1.4;
}
.card-excerpt {
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.6rem;
}
.card-tag {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}
</style>
