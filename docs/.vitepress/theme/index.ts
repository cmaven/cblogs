/**
 * index.ts: VitePress 커스텀 테마 진입점
 * 상세: DefaultTheme 확장, CustomLayout 오버라이드, Vue 컴포넌트 전역 등록
 * 생성일: 2026-04-08 | 수정일: 2026-04-08
 */
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './style.css'

import CustomLayout from './components/CustomLayout.vue'
import Mermaid from './components/Mermaid.vue'
import Asciinema from './components/Asciinema.vue'
import Badge from './components/Badge.vue'
import Button from './components/Button.vue'
import Columns from './components/Columns.vue'
import Column from './components/Column.vue'
import Details from './components/Details.vue'
import Tabs from './components/Tabs.vue'
import Tab from './components/Tab.vue'
import Steps from './components/Steps.vue'
import Step from './components/Step.vue'
import Callout from './components/Callout.vue'
import HomePage from './components/HomePage.vue'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ app }) {
    app.component('Mermaid', Mermaid)
    app.component('Asciinema', Asciinema)
    app.component('Badge', Badge)
    app.component('Button', Button)
    app.component('Columns', Columns)
    app.component('Column', Column)
    app.component('Details', Details)
    app.component('Tabs', Tabs)
    app.component('Tab', Tab)
    app.component('Steps', Steps)
    app.component('Step', Step)
    app.component('Callout', Callout)
    app.component('Hint', Callout)        // Hint는 Callout 별칭
    app.component('Accordions', Details)  // Accordions → Details 매핑
    app.component('Accordion', Details)   // Accordion → Details 매핑
    app.component('HomePage', HomePage)
  }
} satisfies Theme
