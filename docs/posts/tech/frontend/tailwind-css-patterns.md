---
title: "Tailwind CSS 실전 디자인 패턴"
date: 2026-03-15
category: tech
subcategory: frontend
excerpt: "Tailwind CSS로 자주 사용되는 UI 패턴을 빠르게 구현하는 방법을 소개합니다."
tags: [css, tailwind, design, ui]
---

# Tailwind CSS 실전 디자인 패턴

## 카드 컴포넌트

```html
<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm
            hover:shadow-lg transition-shadow">
  <h3 class="text-lg font-semibold text-gray-900">제목</h3>
  <p class="mt-2 text-sm text-gray-600">설명 텍스트</p>
  <span class="mt-3 inline-block rounded-full bg-teal-100 px-3 py-1
               text-xs font-medium text-teal-800">태그</span>
</div>
```

## 반응형 네비게이션

```html
<nav class="flex items-center justify-between px-6 py-4">
  <div class="text-xl font-bold">Logo</div>
  <div class="hidden md:flex gap-6">
    <a href="#" class="text-gray-600 hover:text-gray-900">메뉴1</a>
    <a href="#" class="text-gray-600 hover:text-gray-900">메뉴2</a>
  </div>
  <button class="md:hidden">메뉴</button>
</nav>
```

## 그리드 레이아웃

```html
<!-- 반응형 카드 그리드 -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- 카드들 -->
</div>
```

## 다크 모드 지원

```html
<div class="bg-white dark:bg-gray-900
            text-gray-900 dark:text-gray-100
            border-gray-200 dark:border-gray-700">
  다크 모드 자동 전환
</div>
```

## 유용한 커스텀 유틸리티

```css
@layer utilities {
  .text-balance { text-wrap: balance; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
}
```

Tailwind는 일관된 디자인 시스템을 빠르게 구축하는 데 탁월합니다.
