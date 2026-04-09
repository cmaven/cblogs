<!--
  HomePage.vue: 랜딩 페이지 - 연도별 프로젝트 카드 그리드
  상세: Fumadocs 스타일 카드 레이아웃, Hero 섹션 + 연도별 2열 카드 그리드
  생성일: 2026-04-08
-->
<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'

const { theme } = useData()
const projects = computed(() => theme.value.homeProjects || [])
</script>

<template>
  <main class="home-page">
    <div class="home-container">
      <!-- Hero -->
      <div class="hero-section">
        <h1 class="hero-title">Tech Docs Portal</h1>
        <p class="hero-desc">
          사내 프로젝트 기술 문서를 한곳에서 관리하고 검색합니다.<br/>
          카테고리별 프로젝트 문서를 확인하세요.
        </p>
        <div class="hero-actions">
          <a href="/2026/openstack-helm/openstack-helm_quick_guide" class="btn-brand">문서 보기</a>
          <a href="/guide/" class="btn-outline">가이드</a>
        </div>
      </div>

      <!-- Project Cards -->
      <div v-for="group in projects" :key="group.year" class="year-section">
        <h2 class="year-title">
          <span class="year-dot"></span>
          {{ group.year }}
        </h2>
        <div class="card-grid">
          <a v-for="item in group.items" :key="item.href" :href="item.href" class="project-card">
            <h3 class="card-name">{{ item.name }}</h3>
            <p v-if="item.desc" class="card-desc">{{ item.desc }}</p>
          </a>
        </div>
      </div>

      <!-- Footer -->
      <footer class="home-footer">
        Tech Docs Portal — 사내 기술 문서 관리 시스템
      </footer>
    </div>
  </main>
</template>

<style scoped>
.home-page { min-height: 100vh; padding: 4rem 1rem; }
.home-container { max-width: 90rem; margin: 0 auto; padding: 0 2rem; }

/* Hero */
.hero-section { text-align: center; margin-bottom: 4rem; }
.hero-title { font-size: 3rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 1rem; }
.hero-desc { font-size: 1.1rem; color: var(--vp-c-text-2); max-width: 36rem; margin: 0 auto; line-height: 1.7; }
.hero-actions { margin-top: 2rem; display: flex; gap: 0.75rem; justify-content: center; }
.btn-brand {
  padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600;
  background: var(--vp-c-brand-1); color: #fff; text-decoration: none;
  transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.btn-brand:hover { opacity: 0.9; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.btn-outline {
  padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 500;
  border: 1px solid var(--vp-c-border); text-decoration: none; color: var(--vp-c-text-1);
  transition: all 0.2s;
}
.btn-outline:hover { background: var(--vp-c-bg-soft); border-color: var(--vp-c-brand-1); }

/* Year Section */
.year-section { margin-bottom: 3rem; }
.year-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
.year-dot { display: inline-block; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--vp-c-brand-1); }

/* Card Grid */
.card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
@media (min-width: 1024px) { .card-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1440px) { .card-grid { grid-template-columns: repeat(4, 1fr); } }
@media (max-width: 640px) { .card-grid { grid-template-columns: 1fr; } }

.project-card {
  display: block; padding: 1.5rem; border-radius: 12px;
  border: 1px solid var(--vp-c-border); text-decoration: none;
  transition: all 0.2s; color: var(--vp-c-text-1);
}
.project-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}
.card-name { font-size: 1.1rem; font-weight: 600; margin: 0; }
.card-desc { font-size: 0.875rem; color: var(--vp-c-text-2); margin: 0.25rem 0 0; }

/* Footer */
.home-footer {
  margin-top: 4rem; padding-top: 2rem;
  border-top: 1px solid var(--vp-c-border);
  text-align: center; font-size: 0.875rem; color: var(--vp-c-text-3);
}
</style>
