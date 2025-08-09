<template>
  <div class="app-container">
    <div class="app-header">
      <Header/>
    </div>
    <div class="app-main">
      <Main/>
    </div>
    <div class="app-footer">
      <Footer/>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Header from '../../components/Header.vue';
import Main from "../../components/Main.vue";
import Footer from "../../components/Footer.vue";
import '../../styles/theme.css';

</script>

<style scoped>
.app-container {
  width: 360px;
  height: auto;
  min-height: 450px;
  max-height: 600px;
  background: var(--fr-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-header {
  padding: 16px 20px 12px;
  background: linear-gradient(135deg, var(--fr-card) 0%, var(--fr-surface) 100%);
  border-bottom: 1px solid var(--fr-border);
  flex-shrink: 0;
}

.app-main {
  flex: 1;
  padding: 0;
  background: var(--fr-bg);
  overflow-y: auto;
  min-height: 0;
}

.app-footer {
  padding: 8px 20px;
  background: var(--fr-surface);
  border-top: 1px solid var(--fr-border);
  flex-shrink: 0;
}

/* 现代简约滚动条 */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--fr-text-secondary);
  border-radius: 2px;
  opacity: 0.3;
}

::-webkit-scrollbar-thumb:hover {
  opacity: 0.6;
}

::-webkit-scrollbar-track {
  background: transparent;
}

/* 响应式设计 */
@media screen and (max-height: 600px) {
  .app-container {
    min-height: 400px;
    max-height: 500px;
  }
}

@media screen and (max-width: 400px) {
  .app-container {
    width: 340px;
  }
}
</style>
