<template>
  <!-- 占位符 -->
  <div v-if="!config.on" class="empty-state">
    <el-empty description="插件处于禁用状态" />
  </div>

  <div v-show="config.on" class="settings-container">
    <!-- 缓存开关 -->
    <div class="setting-item">
      <div class="setting-label">
        <span class="setting-title">缓存翻译结果</span>
        <el-tooltip effect="dark" content="开启缓存可以提高翻译速度，减少重复请求，但可能导致翻译结果不是最新的" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-switch v-model="config.useCache" inline-prompt active-text="开" inactive-text="关"/>
    </div>

    <!-- 划词翻译开关 -->
    <div class="setting-item">
      <div class="setting-label">
        <span class="setting-title">划词翻译</span>
        <el-tooltip effect="dark" content="（测试版）选中文本后显示红点，鼠标移到红点上查看翻译结果" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-switch v-model="selectionTranslatorEnabled" inline-prompt active-text="开" inactive-text="关" />
    </div>

    <!-- 全文翻译悬浮球开关 -->
    <div class="setting-item">
      <div class="setting-label">
        <span class="setting-title">全文翻译悬浮球</span>
        <el-tooltip effect="dark" content="（测试版）控制是否显示屏幕边缘的即时翻译悬浮球，用于对整个网页进行翻译" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-switch v-model="floatingBallEnabled" inline-prompt active-text="开" inactive-text="关" />
    </div>

    <!-- 翻译模式 -->
    <div class="setting-row">
      <div class="setting-label">
        <span class="setting-title">翻译模式</span>
      </div>
      <el-select v-model="config.display" placeholder="请选择翻译模式">
        <el-option v-for="item in options.display" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
    </div>

    <!-- 译文样式选择器 -->
    <div v-show="config.display === 1" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">译文样式</span>
        <el-tooltip effect="dark" content="选择双语模式下译文的显示样式，提供多种美观的效果" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-select v-model="config.style" placeholder="请选择译文显示样式">
        <el-option-group v-for="group in styleGroups" :key="group.value" :label="group.label">
          <el-option v-for="item in group.options" :key="item.value" :label="item.label" :value="item.value" />
        </el-option-group>
      </el-select>
    </div>

    <!-- 翻译服务 -->
    <div class="setting-row">
      <div class="setting-label">
        <span class="setting-title">翻译服务</span>
        <el-tooltip effect="dark" content="机器翻译：快速稳定，适合日常使用；AI翻译：更自然流畅，需要配置令牌" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-select v-model="config.service" placeholder="请选择翻译服务">
        <el-option v-for="item in compute.filteredServices" :key="item.value" :label="item.label" :value="item.value" 
                   :disabled="item.disabled" :class="{ 'select-divider': item.disabled }" />
      </el-select>
    </div>

    <!-- 目标语言 -->
    <div class="setting-row">
      <div class="setting-label">
        <span class="setting-title">目标语言</span>
      </div>
      <el-select v-model="config.to" placeholder="请选择目标语言">
        <el-option v-for="item in options.to" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
    </div>

    <!-- 快捷键 -->
    <div class="setting-row">
      <div class="setting-label">
        <span class="setting-title">快捷键</span>
      </div>
      <el-select v-model="config.hotkey" placeholder="请选择快捷键">
        <el-option v-for="item in options.keys" :key="item.value" :label="item.label" :value="item.value" 
                   :disabled="item.disabled" :class="{ 'select-divider': item.disabled }" />
      </el-select>
    </div>

    <!-- 全文翻译快捷键 -->
    <div v-if="floatingBallEnabled" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">全文翻译快捷键</span>
        <el-tooltip effect="dark" content="（测试版）设置快捷键以便快速切换全文翻译状态，无需鼠标点击悬浮球" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-select v-model="config.floatingBallHotkey" placeholder="选择快捷键" size="small">
        <el-option v-for="item in options.floatingBallHotkeys" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
    </div>

    <!-- 访问令牌 -->
    <div v-show="compute.showToken" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">访问令牌</span>
        <el-tooltip effect="dark" content="API访问令牌仅保存在本地，用于访问翻译服务。获取方式请参考对应服务的官方文档；翻译服务为 ollama 时，token 可为任意值" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-input v-model="config.token[config.service]" type="password" show-password placeholder="请输入API访问令牌" />
    </div>

    <!-- DeepLX URL 配置 -->
    <div v-show="compute.showDeepLX" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">服务地址</span>
        <el-tooltip effect="dark" content="DeepLX API 服务地址，默认为本地地址。如果使用远程 DeepLX 服务，请修改为对应的服务地址" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-input v-model="config.deeplx" placeholder="http://localhost:1188/translate" />
    </div>

    <!-- API Key -->
    <div v-show="compute.showAkSk" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">API Key</span>
        <el-tooltip effect="dark" content="百度文心一言API密钥对，用于访问翻译服务" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-input v-model="config.ak" placeholder="请输入Access Key" />
    </div>

    <!-- Secret Key -->
    <div v-show="compute.showAkSk" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">Secret Key</span>
        <el-tooltip effect="dark" content="百度文心一言API密钥对，用于访问翻译服务" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-input v-model="config.sk" type="password" placeholder="请输入Secret Key" />
    </div>

    <!-- 机器人ID -->
    <div v-show="compute.showRobotId" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">机器人ID</span>
        <el-tooltip effect="dark" content="Coze机器人ID，可在Coze开发者文档中查看获取方式" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-input v-model="config.robot_id[config.service]" placeholder="请输入Coze机器人ID" />
    </div>

    <!-- 自定义接口 -->
    <div v-show="compute.showCustom" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">自定义接口</span>
        <el-tooltip effect="dark" content="目前仅支持OpenAI格式的请求接口，如http://localhost:3000/v1/chat/completions，其中 localhost:11434 可更换为任意值。ollama 配置请参考：https://fluent.thinkstu.com/guide/faq.html" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-input v-model="config.custom" placeholder="请输入自定义接口地址" />
    </div>

    <!-- 模型 -->
    <div v-show="compute.showModel" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">模型</span>
      </div>
      <el-select v-model="config.model[config.service]" placeholder="请选择模型">
        <el-option v-for="item in compute.model" :key="item" :label="item" :value="item" />
      </el-select>
    </div>

    <!-- 自定义模型 -->
    <div v-show="compute.showCustomModel" class="setting-row">
      <div class="setting-label">
        <span class="setting-title">{{ config.service === 'doubao' ? '接入点' : '自定义模型' }}</span>
        <el-tooltip effect="dark" :content="config.service === 'doubao' ? '豆包的model为接入点，获取方式见官方文档：https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint' : '注意：自定义模型名称需要与服务商提供的模型名称一致，否则无法使用！'" placement="top">
          <el-icon class="info-icon"><ChatDotRound /></el-icon>
        </el-tooltip>
      </div>
      <el-input v-model="config.customModel[config.service]" placeholder="例如：gemma:7b" />
    </div>

    <!-- 高级选项 -->
    <div class="advanced-section">
      <el-collapse>
        <el-collapse-item title="高级选项" :disabled="compute.showMachine">
          <div class="advanced-settings">
            <!-- 代理地址 -->
            <div v-show="compute.showProxy" class="setting-row">
              <div class="setting-label">
                <span class="setting-title">代理地址</span>
                <el-tooltip effect="dark" content="使用代理可以解决网络无法访问的问题，如不熟悉代理设置请留空！" placement="top">
                  <el-icon class="info-icon"><ChatDotRound /></el-icon>
                </el-tooltip>
              </div>
              <el-input v-model="config.proxy[config.service]" placeholder="默认不使用代理" />
            </div>

            <!-- system角色 -->
            <div v-show="compute.showAI" class="setting-item full">
              <div class="setting-label">
                <span class="setting-title">System</span>
                <el-tooltip effect="dark" content="以系统身份 system 发送的对话，常用于指定 AI 要扮演的角色" placement="top">
                  <el-icon class="info-icon"><ChatDotRound /></el-icon>
                </el-tooltip>
              </div>
              <el-input type="textarea" v-model="config.system_role[config.service]" maxlength="8192" placeholder="system message" :rows="4" />
            </div>

            <!-- user角色 -->
            <div v-show="compute.showAI" class="setting-item full">
              <div class="setting-label">
                <span class="setting-title">User</span>
                <el-tooltip effect="dark" content="以用户身份 user 发送的对话，其中{{to}}表示目标语言，{{origin}}表示待翻译的文本内容，两者不可缺少。" placement="top">
                  <el-icon class="info-icon"><ChatDotRound /></el-icon>
                </el-tooltip>
              </div>
              <el-input type="textarea" v-model="config.user_role[config.service]" maxlength="8192" placeholder="user message template" :rows="4" />
            </div>

            <!-- 恢复默认模板按钮 -->
            <div v-show="compute.showAI" class="reset-template">
              <el-button type="primary" link @click="resetTemplate">
                <el-icon><Refresh /></el-icon>
                恢复默认模板
              </el-button>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 主题设置 -->
    <div class="theme-setting">
      <div class="theme-selector">
        <div 
          v-for="item in options.theme" 
          :key="item.value"
          @click="config.theme = item.value"
          :class="['theme-option', { active: config.theme === item.value }]"
          :title="item.label"
        >
          <el-icon class="theme-icon">
            <Sunny v-if="item.value === 'light'" />
            <Moon v-else-if="item.value === 'dark'" />
            <Monitor v-else />
          </el-icon>
        </div>
      </div>
    </div>
  </div>

  <!-- 刷新提示 -->
  <div v-if="showRefreshTip" class="refresh-tip">
    <div class="refresh-content">
      <span class="refresh-text">设置已更新 需刷新页面生效</span>
    </div>
    <el-button class="refresh-button" type="primary" @click="refreshPage">
      刷新
    </el-button>
  </div>

</template>

<script lang="ts" setup>

// Main 处理配置信息
import { computed, ref, watch, onUnmounted } from 'vue'
import { models, options, servicesType, defaultOption } from "../entrypoints/utils/option";
import { Config } from "@/entrypoints/utils/model";
import { storage } from '@wxt-dev/storage';
import { ChatDotRound, Refresh, Sunny, Moon, Monitor } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import browser from 'webextension-polyfill';

// 初始化深色模式媒体查询
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// 更新主题函数
function updateTheme(theme: string) {
  if (theme === 'auto') {
    // 自动模式下，直接使用系统主题
    const isDark = darkModeMediaQuery.matches;
    console.log('isDark', isDark);

    document.documentElement.classList.toggle('dark', isDark);
  } else {
    // 手动模式下，使用选择的主题
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

// 配置信息
let config = ref(new Config());

// 从 storage 中获取本地配置
storage.getItem('local:config').then((value: any) => {
  if (typeof value === 'string' && value) {
    const parsedConfig = JSON.parse(value);
    Object.assign(config.value, parsedConfig);
  }
  // 初始应用主题
  updateTheme(config.value.theme || 'auto');
});

// 监听 storage 中 'local:config' 的变化
// 当其他页面修改了配置时,会触发这个监听器
// newValue 是新的配置值,oldValue 是旧的配置值
storage.watch('local:config', (newValue: any, oldValue: any) => {
  // 检查 newValue 是否为非空字符串
  if (typeof newValue === 'string' && newValue) {
    // 将新的配置值解析为对象,并合并到当前的 config.value 中
    // 这样可以保持所有页面的配置同步
    Object.assign(config.value, JSON.parse(newValue));
  }
});

// 监听菜单栏配置变化
// 当配置发生改变时,将新的配置序列化为 JSON 字符串并保存到 storage 中
// deep: true 表示深度监听对象内部属性的变化
watch(config, (newValue: any, oldValue: any) => {
  // TODO 监听配置变化，显示刷新提示
  storage.setItem('local:config', JSON.stringify(newValue));
}, { deep: true });

// 计算属性
let compute = ref({
  // 1、是否是AI服务
  showAI: computed(() => servicesType.isAI(config.value.service)),
  // 2、是否是机器翻译
  showMachine: computed(() => servicesType.isMachine(config.value.service)),
  // 3、是否显示代理
  showProxy: computed(() => servicesType.isUseProxy(config.value.service)),
  // 4、是否显示模型
  showModel: computed(() => servicesType.isUseModel(config.value.service)),
  // 5、是否显示token
  showToken: computed(() => servicesType.isUseToken(config.value.service)),
  // 6、是否显示 AkSk
  showAkSk: computed(() => servicesType.isUseAkSk(config.value.service)),
  // 7、获取模型列表
  model: computed(() => models.get(config.value.service) || []),
  // 8、是否需要自定义接口
  showCustom: computed(() => servicesType.isCustom(config.value.service)),
  // 9、是否显示 DeepLX URL 配置
  showDeepLX: computed(() => config.value.service === 'deeplx'),
  // 10、是否自定义模型
  showCustomModel: computed(() => servicesType.isAI(config.value.service) && config.value.model[config.value.service] === "自定义模型"),
  // 11、判断是否为"双语模式"，控制一些翻译服务的显示
  filteredServices: computed(() => options.services.filter((service: any) =>
    !([service.google].includes(service.value) && config.value.display !== 1))
  ),
  // 12、判断是否为 coze
  showRobotId: computed(() => servicesType.isCoze(config.value.service)),
})

// 监听主题变化
watch(() => config.value.theme, (newTheme) => {
  updateTheme(newTheme || 'auto');
});

// 使用 onchange 监听系统主题变化
darkModeMediaQuery.onchange = (e) => {
  if (config.value.theme === 'auto') {
    updateTheme('auto');
  }
};

// 组件卸载时清理
onUnmounted(() => {
  darkModeMediaQuery.onchange = null;
});

// 计算样式分组
const styleGroups = computed(() => {
  const groups = options.styles.filter(item => item.disabled);
  return groups.map(group => ({
    ...group,
    options: options.styles.filter(item => !item.disabled && item.group === group.value)
  }));
});

// 恢复默认模板
const resetTemplate = () => {
  ElMessageBox.confirm(
    '确定要恢复默认的 system 和 user 模板吗？此操作将覆盖当前的自定义模板。',
    '恢复默认模板',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    config.value.system_role[config.value.service] = defaultOption.system_role;
    config.value.user_role[config.value.service] = defaultOption.user_role;
    ElMessage({
      message: '已成功恢复默认翻译模板',
      type: 'success',
      duration: 2000
    });
  }).catch(() => {
    // 用户取消操作，不做任何处理
  });
};

// 悬浮球开关的计算属性
const floatingBallEnabled = computed({
  get: () => !config.value.disableFloatingBall && config.value.on,
  set: (value) => {
    config.value.disableFloatingBall = !value;
    // 向所有激活的标签页发送消息
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, { 
            type: 'toggleFloatingBall',
            isEnabled: value 
          }).catch(() => {
            // 忽略发送失败的错误（可能是页面未加载内容脚本）
          });
        }
      });
    });
  }
});

// 划词翻译开关的计算属性
const selectionTranslatorEnabled = computed({
  get: () => !config.value.disableSelectionTranslator && config.value.on,
  set: (value) => {
    config.value.disableSelectionTranslator = !value;
    // 向所有激活的标签页发送消息
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, { 
            type: 'toggleSelectionTranslator',
            isEnabled: value 
          }).catch(() => {
            // 忽略发送失败的错误（可能是页面未加载内容脚本）
          });
        }
      });
    });
  }
});

// 监听开关变化
const handleSwitchChange = () => {
  showRefreshTip.value = true;
};

// 处理插件状态变化
const handlePluginStateChange = (val: boolean) => {
  // 如果插件被关闭，确保悬浮球和划词翻译也被关闭
  if (!val) {
    // 处理悬浮球
    if (!config.value.disableFloatingBall) {
      config.value.disableFloatingBall = true;
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
    if (!config.value.disableSelectionTranslator) {
      config.value.disableSelectionTranslator = true;
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

// 处理悬浮球开关变化
const toggleFloatingBall = (val: boolean) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { 
          type: 'toggleFloatingBall',
          isEnabled: val 
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
};

// 显示刷新提示
const showRefreshTip = ref(false);

// 刷新页面
const refreshPage = async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    browser.tabs.reload(tabs[0].id);
    showRefreshTip.value = false; // 刷新后隐藏提示
  }
};

</script>

<style scoped>

/* 现代设置布局样式 */
.empty-state {
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.settings-container {
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* 主题选择器样式 - 极简设计 */
.theme-setting {
  display: flex;
  justify-content: center;
  padding: var(--space-2) var(--space-4) var(--space-3);
}

.theme-selector {
  display: flex;
  gap: var(--space-2);
  background: var(--fr-surface);
  padding: var(--space-1);
  border-radius: var(--fr-radius);
  border: 1px solid var(--fr-border);
}

.theme-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--fr-radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  background: transparent;
  color: var(--fr-text-secondary);
}

.theme-option:hover {
  background: var(--fr-hover);
  transform: scale(1.05);
  color: var(--fr-text);
}

.theme-option.active {
  background: var(--fr-primary);
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.theme-icon {
  font-size: 0.9rem;
  color: inherit;
}

.setting-section {
  margin-bottom: var(--space-4);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--fr-card);
  border: 1px solid var(--fr-border);
  border-radius: var(--fr-radius-sm);
  transition: all 0.2s ease;
}

.setting-item:hover {
  border-color: var(--fr-primary);
  box-shadow: var(--fr-shadow-sm);
}

.setting-item.primary {
  background: linear-gradient(135deg, var(--fr-primary-weak), var(--fr-card));
  border-color: var(--fr-primary);
}

.setting-item.full {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-3);
}

.setting-item.full .setting-label {
  align-self: flex-start;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.setting-title {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--fr-text);
}

.info-icon {
  color: var(--fr-text-secondary);
  font-size: 0.875rem;
  cursor: help;
  transition: color 0.2s ease;
}

.info-icon:hover {
  color: var(--fr-primary);
}

.setting-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  background: var(--fr-card);
  border: 1px solid var(--fr-border);
  border-radius: var(--fr-radius-sm);
  transition: all 0.2s ease;
}

.setting-row:hover {
  border-color: var(--fr-primary);
  box-shadow: var(--fr-shadow-sm);
}

/* 高级选项区域 */
.advanced-section {
  margin: var(--space-5) 0;
}

.advanced-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) 0;
}

.reset-template {
  text-align: right;
  padding: var(--space-3) 0;
}

/* 新功能标识 */
.new-feature-badge {
  background: var(--fr-primary);
  color: white;
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
}

/* 工具样式 */
.flex-end { 
  display: flex; 
  justify-content: flex-end; 
}

.select-left { 
  text-align: left; 
}

/* 选择器分组样式 */
.select-divider {
  background: var(--fr-surface) !important;
  color: var(--fr-primary) !important;
  font-size: 0.75rem;
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--fr-border);
  margin: var(--space-1) 0;
  pointer-events: none;
}

/* 表单控件全宽 */
:deep(.el-select), :deep(.el-input) {
  width: 100%;
}

/* 刷新提示样式 */
.refresh-tip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--fr-primary-weak);
  border: 1px solid var(--fr-primary);
  border-radius: var(--fr-radius-sm);
  margin: var(--space-3) var(--space-4);
}

.refresh-content {
  display: flex;
  align-items: center;
}

.refresh-text {
  color: var(--fr-text);
  font-weight: 500;
  font-size: 0.875rem;
}

.refresh-button {
  padding: var(--space-2) var(--space-4);
  font-weight: 500;
  border-radius: var(--fr-radius-sm);
}
</style>