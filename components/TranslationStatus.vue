<template>
  <div class="translation-status-container" v-if="isVisible && isFloatingBallTranslating && !userClosed">
    <div class="translation-status-card">
      <div class="translation-status-header">
        <div class="translation-status-title">翻译进度</div>
        <div class="translation-status-close" @click="close">×</div>
      </div>
      <div class="translation-status-content">
        <div class="translation-status-row">
          <div class="translation-status-label">当前活跃任务:</div>
          <div class="translation-status-value">{{ status.activeTranslations }} / {{ status.maxConcurrent }}</div>
        </div>
        <div class="translation-status-row">
          <div class="translation-status-label">等待中的任务:</div>
          <div class="translation-status-value">{{ status.pendingTranslations }}</div>
        </div>
        <div class="translation-status-progress">
          <div class="translation-status-progress-bar" :style="progressStyle"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { getTranslationStatus } from '../entrypoints/utils/translateApi';

// 组件状态
const isVisible = ref(false);
const isFloatingBallTranslating = ref(false);
const userClosed = ref(false); // 用户是否关闭了状态框
const status = ref({
  activeTranslations: 0,
  pendingTranslations: 0,
  maxConcurrent: 6,
  isQueueFull: false,
  totalTasksInProcess: 0
});

// 计算进度条样式
const progressStyle = computed(() => {
  const percent = status.value.activeTranslations / status.value.maxConcurrent * 100;
  return {
    width: `${percent}%`,
    backgroundColor: percent > 80 ? '#ff7675' : percent > 50 ? '#fdcb6e' : '#00cec9'
  };
});

// 关闭状态卡片
const close = () => {
  userClosed.value = true; // 标记用户已关闭
};

// 重置关闭状态 - 当用户离开页面后重置
const resetClosedState = () => {
  // 监听页面可见性变化
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // 当页面不可见时（用户切换标签页或最小化），重置状态
      setTimeout(() => {
        userClosed.value = false;
      }, 1000);
    }
  });
  
  // 监听 URL 变化
  const lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      userClosed.value = false;
    }
  });
  
  // 观察 document 的子节点变化，这可能发生在 URL 变化时
  urlObserver.observe(document, { subtree: true, childList: true });
  
  return () => {
    document.removeEventListener('visibilitychange', () => {});
    urlObserver.disconnect();
  };
};

// 更新状态的定时器
let statusUpdateTimer: number;

// 创建更新状态的函数
const updateStatus = () => {
  const currentStatus = getTranslationStatus();
  status.value = currentStatus;
  
  // 只有当有活跃任务或等待任务时才显示状态卡片
  isVisible.value = currentStatus.activeTranslations > 0 || currentStatus.pendingTranslations > 0;
};

// 监听悬浮球翻译状态变化
const listenToFloatingBallState = () => {
  // 监听自定义事件: 翻译开始
  const handleTranslationStarted = () => {
    isFloatingBallTranslating.value = true;
    // 当新的翻译开始时，如果是同一页面内重新开始翻译，也要重置用户关闭状态
    if (!isVisible.value) {
      userClosed.value = false;
    }
  };
  
  // 监听自定义事件: 翻译结束
  const handleTranslationEnded = () => {
    isFloatingBallTranslating.value = false;
  };
  
  // 添加事件监听器
  document.addEventListener('fluentread-translation-started', handleTranslationStarted);
  document.addEventListener('fluentread-translation-ended', handleTranslationEnded);
  
  // 返回清理函数
  return {
    cleanup: () => {
      document.removeEventListener('fluentread-translation-started', handleTranslationStarted);
      document.removeEventListener('fluentread-translation-ended', handleTranslationEnded);
    }
  };
};

// 存储事件监听器的清理函数
let eventListenerCleanup: { cleanup: () => void };
let resetClosedStateCleanup: () => void;

// 组件挂载时启动定时器和事件监听
onMounted(() => {
  updateStatus(); // 立即执行一次更新
  statusUpdateTimer = window.setInterval(updateStatus, 500);
  eventListenerCleanup = listenToFloatingBallState();
  resetClosedStateCleanup = resetClosedState();
});

// 组件卸载时清理定时器和事件监听
onUnmounted(() => {
  clearInterval(statusUpdateTimer);
  eventListenerCleanup.cleanup();
  resetClosedStateCleanup();
});
</script>

<style scoped>
.translation-status-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.translation-status-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  width: 200px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.translation-status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
}

.translation-status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 500;
  font-size: 12px;
}

.translation-status-close {
  cursor: pointer;
  font-size: 14px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.15s ease;
  opacity: 0.8;
}

.translation-status-close:hover {
  background-color: rgba(255, 255, 255, 0.25);
  opacity: 1;
}

.translation-status-content {
  padding: 10px 12px;
}

.translation-status-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.4;
}

.translation-status-label {
  color: #6b7280;
  font-weight: 400;
}

.translation-status-value {
  font-weight: 600;
  color: #374151;
  font-variant-numeric: tabular-nums;
}

.translation-status-progress {
  height: 4px;
  background-color: #f3f4f6;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
}

.translation-status-progress-bar {
  height: 100%;
  border-radius: 2px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 暗黑模式支持 */
:root[class="dark"] .translation-status-card {
  background: rgba(31, 41, 55, 0.95);
  border-color: rgba(75, 85, 99, 0.3);
}

:root[class="dark"] .translation-status-header {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
}

:root[class="dark"] .translation-status-label {
  color: #9ca3af;
}

:root[class="dark"] .translation-status-value {
  color: #f9fafb;
}

:root[class="dark"] .translation-status-progress {
  background-color: #374151;
}

/* 媒体查询支持 */
@media (prefers-color-scheme: dark) {
  :root:not([class="light"]) .translation-status-card {
    background: rgba(31, 41, 55, 0.95);
    border-color: rgba(75, 85, 99, 0.3);
  }
  
  :root:not([class="light"]) .translation-status-header {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  }
  
  :root:not([class="light"]) .translation-status-label {
    color: #9ca3af;
  }
  
  :root:not([class="light"]) .translation-status-value {
    color: #f9fafb;
  }
  
  :root:not([class="light"]) .translation-status-progress {
    background-color: #374151;
  }
}
</style> 