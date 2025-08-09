<template>
  <div class="header-container">
    <div class="title-section">
      <h1 class="title">流畅阅读 <span class="version">V{{version}}</span></h1>
    </div>
    <div class="status-section">
      <span class="status-label">插件状态</span>
      <el-switch v-model="config.on" inline-prompt active-text="开" inactive-text="关" @change="handlePluginStateChange" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
import { Config } from "../entrypoints/utils/model";
import { storage } from '@wxt-dev/storage';
import browser from 'webextension-polyfill';

const version = process.env.VUE_APP_VERSION

// 配置信息
let config = reactive(new Config());

// 从 storage 中获取本地配置
storage.getItem('local:config').then((value: any) => {
  if (typeof value === 'string' && value) {
    const parsedConfig = JSON.parse(value);
    Object.assign(config, parsedConfig);
  }
});

// 监听 storage 中 'local:config' 的变化
storage.watch('local:config', (newValue: any, oldValue: any) => {
  if (typeof newValue === 'string' && newValue) {
    Object.assign(config, JSON.parse(newValue));
  }
});

// 处理插件状态变化
const handlePluginStateChange = (val: boolean) => {
  // 同步更新到storage
  storage.setItem('local:config', JSON.stringify(config));
  
  // 如果插件被关闭，确保悬浮球和划词翻译也被关闭
  if (!val) {
    // 处理悬浮球
    if (!config.disableFloatingBall) {
      config.disableFloatingBall = true;
      // 向所有激活的标签页发送消息，关闭悬浮球
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { 
              type: 'toggleFloatingBall',
              isEnabled: false
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
    
    // 处理划词翻译
    if (!config.disableSelectionTranslator) {
      config.disableSelectionTranslator = true;
      // 向所有激活的标签页发送消息，关闭划词翻译
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { 
              type: 'toggleSelectionTranslator',
              isEnabled: false
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
  }
};
</script>

<style scoped>
.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section {
  flex: 1;
}

.title {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0;
  color: var(--fr-text);
  display: flex;
  align-items: center;
  letter-spacing: -0.02em;
}

.version {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--fr-text-secondary);
  background: var(--fr-primary-weak);
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 8px;
}

.status-section {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-label {
  font-size: 0.75rem;
  color: var(--fr-text-secondary);
  font-weight: 500;
}
</style>
