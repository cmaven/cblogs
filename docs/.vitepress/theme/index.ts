/**
 * index.ts: cblogs 커스텀 테마 진입점
 * 상세: DefaultTheme 확장, 블로그 컴포넌트 전역 등록
 * 생성일: 2026-04-13 | 수정일: 2026-04-13
 */
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './style.css'

import CustomLayout from './components/CustomLayout.vue'
import Badge from './components/Badge.vue'
import Button from './components/Button.vue'
import Callout from './components/Callout.vue'
import Details from './components/Details.vue'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ app }) {
    app.component('Badge', Badge)
    app.component('Button', Button)
    app.component('Callout', Callout)
    app.component('Hint', Callout)
    app.component('Details', Details)
  }
} satisfies Theme
