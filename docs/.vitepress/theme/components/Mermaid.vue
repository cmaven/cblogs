<!--
  Mermaid.vue: Mermaid 다이어그램 렌더링 컴포넌트
  상세: 인라인은 원본 출력형식 유지(+세로 잘림 보정), "확대 보기"는 팝업에서
        SVG 픽셀 크기를 키워 선명하게 확대(foreignObject 래스터 흐림 방지)
  생성일: 2026-04-08 | 수정일: 2026-06-08
-->
<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useData } from 'vitepress'

const props = defineProps({ chart: { type: String, required: true } })
const container = ref(null)     // 인라인: v-html 로 SVG 주입되는 래퍼
const modalBody = ref(null)     // 팝업: 스크롤/패닝 영역(내부에 .mermaid-wrapper)
const svgHtml = ref('')         // 렌더된 SVG 문자열(인라인·팝업 공용)
const errorMsg = ref('')        // 구문/렌더 오류 메시지
const { isDark } = useData()
let renderSeq = 0

// 측정용 hidden div(body 직속)와 렌더 SVG의 폰트 metric을 일치시키기 위해
// 'inherit' 대신 본문에서 실제로 쓰이는 폰트 스택을 명시. PRIMARY_FONT 는
// document.fonts.load() 와 mermaid fontFamily 양쪽에서 공유(변경 시 동기화).
const PRIMARY_FONT = "'SUITE Variable'"
const FONT_STACK = `${PRIMARY_FONT}, 'SUITE-Regular', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

// ── 팝업(확대 보기) 상태 ──────────────────────────────────────────────────
const isOpen = ref(false)
const zoom = ref(1)
// 매우 넓은 다이어그램(viewBox 수천 px)도 화면에 맞춰 시작할 수 있도록 하한을 낮춘다.
const MIN_ZOOM = 0.05
const MAX_ZOOM = 8
function clampZoom(z) { return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) }

// 다이어그램 전체가 모달 영역 안에 들어오는 배율을 계산(fit-to-screen).
// 작은 다이어그램은 100%를 넘겨 키우지 않는다(과확대 방지).
function fitZoom() {
  const body = modalBody.value
  const svg = body && body.querySelector('svg')
  if (!body || !svg) return 1
  const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null
  const baseW = vb ? vb.width : 0
  const baseH = vb ? vb.height : 0
  if (!baseW || !baseH) return 1
  const cs = getComputedStyle(body)
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
  const availW = Math.max(0, body.clientWidth - padX)
  const availH = Math.max(0, body.clientHeight - padY)
  const z = Math.min(availW / baseW, availH / baseH)
  return Math.min(Math.max(z, MIN_ZOOM), 1)
}

function openModal() {
  isOpen.value = true
  zoom.value = 1
  nextTick(() => {
    normalizeNodeHeights(modalBody.value)
    // 열 때는 전체 구조가 한눈에 보이도록 화면맞춤 배율로 시작 → 이후 휠/버튼으로 확대
    zoom.value = fitZoom()
    applyZoom()
    // 전체가 보이도록 가로·세로 모두 가운데 정렬
    const body = modalBody.value
    if (body) {
      body.scrollLeft = (body.scrollWidth - body.clientWidth) / 2
      body.scrollTop = (body.scrollHeight - body.clientHeight) / 2
    }
  })
}
function closeModal() { isOpen.value = false }

// 확대는 SVG 의 픽셀 width 를 직접 키운다(= 그 해상도로 재렌더 → foreignObject 글자 선명).
// CSS transform:scale 은 비트맵 확대라 흐려지므로 사용하지 않는다.
function applyZoom() {
  const body = modalBody.value
  const svg = body && body.querySelector('svg')
  if (!svg) return
  const baseW = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal.width : 0
  if (!baseW) return
  svg.style.width = `${baseW * zoom.value}px`
  svg.style.maxWidth = 'none'
  svg.style.height = 'auto'
}
function zoomIn() { zoom.value = clampZoom(zoom.value * 1.25); applyZoom() }
function zoomOut() { zoom.value = clampZoom(zoom.value / 1.25); applyZoom() }
// 리셋 = 화면맞춤(전체 보기). 큰 다이어그램에서 100% 복귀보다 유용.
function resetZoom() { zoom.value = fitZoom(); applyZoom() }

// 팝업 휠 줌: 커서 아래 지점을 고정한 채 확대(스크롤 보정). 픽셀 width 변경이라 선명.
function onModalWheel(e) {
  e.preventDefault()
  const body = modalBody.value
  if (!body) return
  const rect = body.getBoundingClientRect()
  const prev = zoom.value
  const next = clampZoom(prev * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
  if (next === prev) return
  const ratio = next / prev
  // 커서 아래의 콘텐츠 좌표(스크롤 포함)
  const cx = body.scrollLeft + (e.clientX - rect.left)
  const cy = body.scrollTop + (e.clientY - rect.top)
  zoom.value = next
  applyZoom()
  body.scrollLeft = cx * ratio - (e.clientX - rect.left)
  body.scrollTop = cy * ratio - (e.clientY - rect.top)
}

// 드래그 패닝: 스크롤 위치를 옮긴다(transform 미사용 → 흐림 없음).
let panning = false
let panStart = { x: 0, y: 0, sl: 0, st: 0 }
function onPanStart(e) {
  panning = true
  const body = modalBody.value
  panStart = { x: e.clientX, y: e.clientY, sl: body.scrollLeft, st: body.scrollTop }
  try { body.setPointerCapture(e.pointerId) } catch { /* noop */ }
}
function onPanMove(e) {
  if (!panning) return
  const body = modalBody.value
  body.scrollLeft = panStart.sl - (e.clientX - panStart.x)
  body.scrollTop = panStart.st - (e.clientY - panStart.y)
}
function onPanEnd(e) {
  panning = false
  const body = modalBody.value
  try { body && body.releasePointerCapture(e.pointerId) } catch { /* noop */ }
}

function onKeydown(e) {
  if (e.key === 'Escape' && isOpen.value) closeModal()
}

// ── 렌더 큐(다중 컴포넌트 동시 렌더 시 mermaid 전역 상태 경합 방지) ──────────
function getRenderState() {
  if (!globalThis.__cdocsMermaidRenderState) {
    globalThis.__cdocsMermaidRenderState = { queue: Promise.resolve() }
  }
  return globalThis.__cdocsMermaidRenderState
}

function enqueueMermaidRender(job) {
  const state = getRenderState()
  const run = state.queue.catch(() => {}).then(job)
  state.queue = run.catch(() => {})
  return run
}

/**
 * mermaid.render()/parse()는 측정·에러 렌더링용으로 document.body 에 임시 SVG/div 를
 * 남길 수 있고, SPA 라우팅으로 컴포넌트가 언마운트돼도 이 잔여 노드가 화면에 남아
 * "Syntax error in text — mermaid version …" 가 다른 페이지까지 따라다니는 문제를
 * 일으킨다. body 직속의 고아 mermaid 노드를 안전하게 제거.
 */
function cleanupOrphanMermaid({ includeRenderNodes = true } = {}) {
  if (typeof document === 'undefined') return
  const selectors = [
    'body > svg[aria-roledescription="error"]',
  ]
  if (includeRenderNodes) {
    selectors.push(
      'body > svg[id^="mermaid-"]',
      'body > svg[id^="dmermaid-"]',
      'body > div[id^="dmermaid-"]',
      'body > [id^="d"][id*="mermaid"]',
    )
  }
  document.querySelectorAll(selectors.join(',')).forEach((el) => el.remove())
}

/**
 * htmlLabels(=foreignObject) 라벨은 mermaid 가 body 의 hidden div 에서 높이를 측정한 뒤
 * 그 값으로 박스(rect) 높이를 고정한다. 측정/렌더 줄 수가 어긋나 라벨이 한 줄 더 늘어나면
 * 늘어난 줄이 박스 아래로 넘쳐(브라우저가 foreignObject 를 클립) 잘려 보인다.
 * → 렌더 후 실제 콘텐츠 높이를 다시 재서, 부족하면 foreignObject·rect 를 확장하고
 *   중앙정렬을 유지한 뒤, 잘리지 않도록 viewBox 를 재계산한다.
 *   (원본 출력 크기를 보존하기 위해 max-width 는 콘텐츠 자연폭 px 로만 갱신한다.)
 */
function normalizeNodeHeights(root) {
  if (!root) return
  const svg = root.querySelector('svg')
  if (!svg) return

  // 1) 폭 안정화(필수): SVG 자연폭을 px 로 명시한다.
  //    mermaid 는 width="100%" 로 출력하는데, 이를 flex(shrink-to-fit) 부모에 두면
  //    SVG 에 intrinsic 폭이 없어 브라우저 기본값 300px 로 축소된다(다이어그램이 작게
  //    나오는 원인). viewBox 폭을 width:px 로 못박아 방지하고, max-width:100% 로 좁은
  //    화면에선 축소되게 해 원본 useMaxWidth 동작을 유지한다.
  const setNaturalWidth = (px) => {
    svg.style.width = `${px}px`
    svg.style.maxWidth = '100%'
    svg.style.height = 'auto'
    svg.removeAttribute('height')
  }
  try {
    const vbW = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal.width : 0
    if (vbW > 0) setNaturalWidth(vbW)
  } catch { /* noop */ }

  // 2) 세로 잘림 보정(getBBox 필요)
  if (typeof svg.getBBox !== 'function') return
  try {
    svg.querySelectorAll('g.node').forEach((node) => {
      const fo = node.querySelector('foreignObject')
      const div = fo && fo.firstElementChild
      if (!fo || !div) return
      const contentH = div.scrollHeight
      const foH = fo.height.baseVal.value
      const delta = contentH - foH
      if (delta <= 0.5) return
      fo.setAttribute('height', String(contentH))
      fo.setAttribute('y', String(fo.y.baseVal.value - delta / 2))
      // 노드의 직속 컨테이너 rect 만 동심 확장(아이콘/그림자 등 자손 rect 과확장 방지)
      node.querySelectorAll(':scope > rect').forEach((r) => {
        r.setAttribute('height', String(r.height.baseVal.value + delta))
        r.setAttribute('y', String(r.y.baseVal.value - delta / 2))
      })
    })
    // 노드 확장으로 가장자리가 잘리지 않도록 viewBox 재계산. getBBox 0/음수면 건너뜀.
    const bbox = svg.getBBox()
    if (bbox.width > 0 && bbox.height > 0) {
      const pad = 8
      const w = bbox.width + pad * 2
      svg.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${w} ${bbox.height + pad * 2}`)
      setNaturalWidth(w)
    }
  } catch {
    /* 측정 실패(비표시 컨테이너 등) 시 원본 SVG 유지 */
  }
}

async function render() {
  if (typeof document === 'undefined') return
  const seq = ++renderSeq
  const code = props.chart.replaceAll('\\n', '\n')

  await enqueueMermaidRender(async () => {
    if (seq !== renderSeq) return
    cleanupOrphanMermaid()
    const { default: mermaid } = await import('mermaid')

    // 측정·렌더 폰트 metric 일치를 위해 웹폰트 로딩 완료를 보장(세로 잘림 핵심 원인).
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready
        await document.fonts.load(`1em ${PRIMARY_FONT}`).catch(() => {})
      }
    } catch { /* 폰트 API 미지원 환경은 무시 */ }
    if (seq !== renderSeq) return

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      fontFamily: FONT_STACK,
      theme: isDark.value ? 'dark' : 'default',
      flowchart: {
        htmlLabels: true,
        useMaxWidth: true,
        // 박스 padding을 키워 한글 폰트의 ascender/descender 비대칭으로 인한
        // 시각적 위/아래 공백 차이가 비율적으로 작게 보이도록 완화 (기본 8 → 16)
        padding: 16,
      },
    })

    // 사전 파싱: 실패하면 mermaid 가 body 에 에러 SVG 를 만들기 전에 우리가 가로채서
    // 컴포넌트 내부에만 메시지를 표시. 페이지 전체로 에러가 새는 것을 막는다.
    try {
      await mermaid.parse(code)
    } catch (err) {
      cleanupOrphanMermaid()
      const msg = err && err.message ? err.message : String(err)
      if (seq === renderSeq) { svgHtml.value = ''; errorMsg.value = `Mermaid 구문 오류:\n${msg}` }
      return
    }

    const id = 'mermaid-' + Math.random().toString(36).slice(2)
    try {
      const { svg } = await mermaid.render(id, code)
      if (seq !== renderSeq) return
      errorMsg.value = ''
      svgHtml.value = svg
      // v-html 주입 후 DOM 에서 실제 높이를 재측정해 잘림 보정(인라인)
      await nextTick()
      if (seq === renderSeq) normalizeNodeHeights(container.value)
    } catch (err) {
      const msg = err && err.message ? err.message : String(err)
      if (seq === renderSeq) { svgHtml.value = ''; errorMsg.value = `Mermaid 렌더링 실패:\n${msg}` }
    } finally {
      cleanupOrphanMermaid()
    }
  })
}

onMounted(() => {
  render()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  cleanupOrphanMermaid({ includeRenderNodes: false })
  window.removeEventListener('keydown', onKeydown)
})
// 다크모드 토글 시 새 SVG 로 다시 렌더(팝업은 닫혀 있어 줌 상태 누수 없음)
watch(isDark, render)
</script>

<template>
  <div class="mermaid-block">
    <!-- 인라인: 기존 출력형식 그대로 유지(다이어그램 캔버스) -->
    <div class="mermaid-canvas">
      <pre v-if="errorMsg" class="mermaid-error">{{ errorMsg }}</pre>
      <div v-else ref="container" class="mermaid-wrapper" v-html="svgHtml" />
    </div>

    <!-- 하단 푸터: 구분선으로 분리 + 우측 정렬(경계 겹침 제거) -->
    <div v-if="!errorMsg" class="mermaid-footer">
      <button type="button" class="mermaid-zoom-btn" @click="openModal">🔍 확대 보기</button>
    </div>

    <!-- 팝업(모달): 선명한 확대/축소 + 패닝 -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="mermaid-modal"
        role="dialog"
        aria-modal="true"
        @click.self="closeModal"
      >
        <div class="mermaid-modal__toolbar">
          <button type="button" title="축소" aria-label="축소" @click="zoomOut">－</button>
          <span class="mermaid-modal__pct">{{ Math.round(zoom * 100) }}%</span>
          <button type="button" title="확대" aria-label="확대" @click="zoomIn">＋</button>
          <button type="button" title="전체 보기 (화면 맞춤)" aria-label="전체 보기" @click="resetZoom">⟲</button>
          <button type="button" class="mermaid-modal__close" title="닫기 (Esc)" aria-label="닫기" @click="closeModal">✕</button>
        </div>
        <div
          ref="modalBody"
          class="mermaid-modal__body"
          @wheel="onModalWheel"
          @pointerdown="onPanStart"
          @pointermove="onPanMove"
          @pointerup="onPanEnd"
          @pointercancel="onPanEnd"
        >
          <div class="mermaid-wrapper" v-html="svgHtml" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 외곽 박스: 테두리/배경/둥근모서리를 블록에 두고 내부를 캔버스+푸터로 분리 */
.mermaid-block {
  margin: 1.5rem 0;
  border: 1px solid var(--vp-c-border);
  border-radius: 0.5rem;
  background: var(--vp-c-bg-elv);
  overflow: hidden; /* 둥근 모서리에 맞춰 자식 클립 */
}

/* 다이어그램 캔버스: 기존 출력형식(중앙정렬·가로스크롤·패딩) 유지 */
.mermaid-canvas {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding: 1rem;
}

/* 하단 푸터: 구분선으로 다이어그램과 분리, 버튼을 우측 끝으로 정렬 */
.mermaid-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.mermaid-zoom-btn {
  font-size: 0.78rem;
  line-height: 1;
  padding: 0.35rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.mermaid-zoom-btn:hover {
  background: var(--vp-c-bg);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.mermaid-error {
  color: #c00;
  white-space: pre-wrap;
  font-size: 0.85em;
  margin: 0;
}

/* ── 팝업(모달) ── */
.mermaid-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  /* 불투명 배경: 뒤쪽 페이지(사이드바·본문)가 다이어그램 위로 비쳐 보이지 않도록 함 */
  background: var(--vp-c-bg);
}
.mermaid-modal__toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
}
.mermaid-modal__toolbar button {
  width: 2.1rem;
  height: 2.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  border: 1px solid var(--vp-c-border);
  border-radius: 0.375rem;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.mermaid-modal__toolbar button:hover {
  background: var(--vp-c-bg);
  border-color: var(--vp-c-brand-1);
}
.mermaid-modal__pct {
  min-width: 3.2rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}
.mermaid-modal__close {
  margin-left: auto;
}
.mermaid-modal__body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 1.5rem;
  cursor: grab;
  touch-action: none;
}
.mermaid-modal__body:active {
  cursor: grabbing;
}
</style>
