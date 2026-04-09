<!-- VersionSelector.vue: 프로젝트 버전 전환 드롭다운 | 생성일: 2026-04-09 -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vitepress'

const route = useRoute()
const router = useRouter()
const isOpen = ref(false)
const selectorRef = ref(null)

const versionMap = {
  '/2025/project-alpha/': {
    label: 'Project Alpha',
    versions: [
      { text: 'v1', link: '/2025/project-alpha/', current: true },
      { text: 'v2', link: '/2025/project-alpha-v2/' },
    ],
  },
  '/2025/project-alpha-v2/': {
    label: 'Project Alpha',
    versions: [
      { text: 'v1', link: '/2025/project-alpha/' },
      { text: 'v2', link: '/2025/project-alpha-v2/', current: true },
    ],
  },
}

const activeConfig = computed(() => {
  for (const [prefix, config] of Object.entries(versionMap)) {
    if (route.path.startsWith(prefix)) return config
  }
  return null
})

const currentVersion = computed(() => {
  if (!activeConfig.value) return null
  return activeConfig.value.versions.find(v => v.current) || activeConfig.value.versions[0]
})

function toggle() {
  isOpen.value = !isOpen.value
}

function selectVersion(ver) {
  isOpen.value = false
  if (!ver.current) router.go(ver.link)
}

function onClickOutside(e) {
  if (selectorRef.value && !selectorRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div v-if="activeConfig" class="version-selector" ref="selectorRef">
    <button class="version-trigger" @click="toggle" :class="{ open: isOpen }">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      <span>{{ currentVersion?.text }}</span>
      <svg class="chevron" :class="{ rotated: isOpen }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>
    <Transition name="vdrop">
      <ul v-if="isOpen" class="version-list">
        <li
          v-for="ver in activeConfig.versions"
          :key="ver.text"
          :class="{ active: ver.current }"
          @click="selectVersion(ver)"
        >
          {{ ver.text }}
          <span v-if="ver.current" class="current-tag">현재</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.version-selector {
  position: relative;
  padding: 0.15rem 0.5rem;
  margin-bottom: 0.25rem;
}

.version-trigger {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-base);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}
.version-trigger:hover,
.version-trigger.open {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}

.chevron {
  margin-left: auto;
  transition: transform 0.2s;
}
.chevron.rotated {
  transform: rotate(180deg);
}

.version-list {
  position: absolute;
  left: 0.5rem;
  right: 0.5rem;
  top: calc(100% + 2px);
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.version-list li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: all 0.15s;
}
.version-list li:hover {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.version-list li.active {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.current-tag {
  font-size: 0.6rem;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.vdrop-enter-active,
.vdrop-leave-active {
  transition: all 0.15s ease;
}
.vdrop-enter-from,
.vdrop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
