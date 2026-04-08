<!--
  Asciinema.vue: 터미널 녹화 재생 컴포넌트 (asciinema-player 동적 임포트)
  생성일: 2026-04-08 | 수정일: 2026-04-08
-->
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useData } from 'vitepress'

const props = defineProps({
  src: { type: String, required: true },
  rows: Number,
  cols: Number,
  autoPlay: { type: Boolean, default: false },
  loop: { type: Boolean, default: false },
  speed: { type: Number, default: 1 },
  idleTimeLimit: Number,
  fit: { type: String, default: 'width' },
})

const container = ref(null)
let player = null
const { isDark } = useData()

async function createPlayer() {
  if (!container.value) return
  if (player?.dispose) player.dispose()
  container.value.innerHTML = ''

  const AsciinemaPlayer = await import('asciinema-player')
  player = AsciinemaPlayer.create(props.src, container.value, {
    rows: props.rows,
    cols: props.cols,
    autoPlay: props.autoPlay,
    loop: props.loop,
    speed: props.speed,
    idleTimeLimit: props.idleTimeLimit,
    theme: isDark.value ? 'monokai' : 'asciinema',
    fit: props.fit,
  })
}

onMounted(createPlayer)
watch(isDark, createPlayer)
onUnmounted(() => { if (player?.dispose) player.dispose() })
</script>

<template>
  <div class="mdx-asciinema my-6">
    <div ref="container" />
  </div>
</template>
