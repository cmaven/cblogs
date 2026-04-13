<!--
  BlogHome.vue: 블로그 메인 페이지 - 포스트 리스트 + 카테고리 필터 + 페이지네이션
  생성일: 2026-04-13 | 수정일: 2026-04-13
-->
<script setup>
import { ref, computed } from 'vue'
import { useData } from 'vitepress'
import BlogSidebar from './BlogSidebar.vue'
import BlogPostCard from './BlogPostCard.vue'
import BlogPagination from './BlogPagination.vue'

const { theme } = useData()
const allPosts = computed(() => theme.value.blogPosts || [])

const POSTS_PER_PAGE = 6

const selectedCategory = ref('')
const selectedSubcategory = ref('')
const currentPage = ref(1)

const filteredPosts = computed(() => {
  let posts = allPosts.value
  if (selectedCategory.value) {
    posts = posts.filter(p => p.category === selectedCategory.value)
  }
  if (selectedSubcategory.value) {
    posts = posts.filter(p => p.subcategory === selectedSubcategory.value)
  }
  return posts
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredPosts.value.length / POSTS_PER_PAGE)))

const pagedPosts = computed(() => {
  const start = (currentPage.value - 1) * POSTS_PER_PAGE
  return filteredPosts.value.slice(start, start + POSTS_PER_PAGE)
})

const filterLabel = computed(() => {
  if (!selectedCategory.value) return '전체 포스트'
  const cat = (theme.value.blogCategories || []).find(c => c.key === selectedCategory.value)
  if (!cat) return '전체 포스트'
  if (selectedSubcategory.value) {
    const sub = cat.subcategories.find(s => s.key === selectedSubcategory.value)
    return sub ? `${cat.label} > ${sub.label}` : cat.label
  }
  return cat.label
})

function onCategorySelect(cat, sub) {
  selectedCategory.value = cat
  selectedSubcategory.value = sub
  currentPage.value = 1
}

function onPageChange(page) {
  currentPage.value = page
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="blog-layout">
    <BlogSidebar
      :selected-category="selectedCategory"
      :selected-subcategory="selectedSubcategory"
      @select="onCategorySelect"
    />

    <main class="blog-main">
      <div class="blog-container">
        <!-- 헤더 -->
        <div class="blog-header">
          <h1 class="blog-heading">{{ filterLabel }}</h1>
          <p class="blog-count">{{ filteredPosts.length }}개의 포스트</p>
        </div>

        <!-- 포스트 리스트 -->
        <div v-if="pagedPosts.length" class="post-grid">
          <BlogPostCard
            v-for="post in pagedPosts"
            :key="post.link"
            :title="post.title"
            :date="post.date"
            :category-label="post.categoryLabel"
            :subcategory-label="post.subcategoryLabel"
            :excerpt="post.excerpt"
            :tags="post.tags"
            :link="post.link"
          />
        </div>

        <div v-else class="no-posts">
          <p>아직 포스트가 없습니다.</p>
        </div>

        <!-- 페이지네이션 -->
        <BlogPagination
          :current-page="currentPage"
          :total-pages="totalPages"
          @page-change="onPageChange"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.blog-layout {
  display: flex;
  min-height: 100vh;
}
.blog-main {
  flex: 1;
  margin-left: 280px;
  padding: 2rem;
}
.blog-container {
  max-width: 900px;
  margin: 0 auto;
}
.blog-header {
  margin-bottom: 2rem;
}
.blog-heading {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0;
}
.blog-count {
  font-size: 0.875rem;
  color: var(--vp-c-text-3);
  margin: 0.25rem 0 0;
}
.post-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.no-posts {
  text-align: center;
  padding: 4rem 0;
  color: var(--vp-c-text-3);
}

@media (max-width: 768px) {
  .blog-main {
    margin-left: 0;
    padding: 1rem;
  }
}
</style>
