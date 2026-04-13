---
title: "CSS Grid로 반응형 레이아웃 만들기"
date: 2026-04-10
category: tech
subcategory: frontend
excerpt: "CSS Grid의 핵심 속성과 실전 레이아웃 패턴을 예제로 알아봅니다."
tags: [css, layout, responsive]
---

# CSS Grid로 반응형 레이아웃 만들기

## CSS Grid 기초

CSS Grid는 2차원 레이아웃 시스템으로, 행(row)과 열(column)을 동시에 제어할 수 있습니다.

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
```

## 핵심 속성

### grid-template-columns / rows

```css
/* 고정 크기 */
grid-template-columns: 200px 1fr 200px;

/* 반복 패턴 */
grid-template-columns: repeat(4, 1fr);

/* 자동 채우기 (반응형) */
grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
```

### grid-area로 이름 기반 배치

```css
.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "footer footer footer";
  grid-template-columns: 250px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}

.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.aside   { grid-area: aside; }
.footer  { grid-area: footer; }
```

## 반응형 카드 그리드

가장 많이 사용되는 패턴입니다:

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
}
```

이 한 줄이면 화면 크기에 따라 자동으로 열 수가 조절됩니다.

## Grid vs Flexbox

| 상황 | 추천 |
|------|------|
| 1차원 배치 (한 방향) | Flexbox |
| 2차원 배치 (행+열) | Grid |
| 콘텐츠 기반 크기 | Flexbox |
| 레이아웃 기반 배치 | Grid |

실제로는 Grid와 Flexbox를 함께 사용하는 것이 가장 효과적입니다. Grid로 전체 레이아웃을 잡고, 각 셀 안에서 Flexbox로 정렬하는 패턴을 추천합니다.
