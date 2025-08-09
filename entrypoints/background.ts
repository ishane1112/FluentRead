import {_service} from "@/entrypoints/service/_service";
import {config} from "@/entrypoints/utils/config";
import {reportTranslationCount} from "@/entrypoints/utils/influx-reporter";

export default defineBackground({
    persistent: {
        safari: false,
    },
    main() {
        // 处理翻译请求与控制消息
        browser.runtime.onMessage.addListener((message: any) => {
            try {
                // 设置页打开
                if (message?.type === 'openOptionsPage') {
                    // 若未配置 options 页面，此调用会被忽略，但不会抛错
                    if (browser.runtime.openOptionsPage) {
                        browser.runtime.openOptionsPage();
                    }
                    return Promise.resolve(true);
                }

                // 翻译请求（必须包含 origin）
                if (message && typeof message.origin === 'string') {
                    const service = _service[config.service];
                    if (typeof service === 'function') {
                        return service(message);
                    }
                    // 未配置可用的 service，直接返回原文以避免前端报错
                    return Promise.resolve(message.origin);
                }

                // 其他未识别的消息，直接应答
                return Promise.resolve(null);
            } catch (error) {
                // 兜底：避免未处理的异常导致 Promise 未捕获拒绝
                return Promise.reject(error);
            }
        });

        reportTranslationCount().catch(error => {
            console.error('init report failed:', error);
        });
        setInterval(() => {
            reportTranslationCount().catch(error => {
                console.error('report failed:', error);
            });
        }, 300000);
    }
});
