import { checkConfig, searchClassName, skipNode } from "../utils/check";
import { cache } from "../utils/cache";
import { options, servicesType } from "../utils/option";
import { insertFailedTip, insertLoadingSpinner } from "../utils/icon";
import { styles } from "@/entrypoints/utils/constant";
import { beautyHTML, grabNode, grabAllNode, LLMStandardHTML, smashTruncationStyle } from "@/entrypoints/main/dom";
import { detectlang, throttle } from "@/entrypoints/utils/common";
import { getMainDomain, replaceCompatFn } from "@/entrypoints/main/compat";
import { config } from "@/entrypoints/utils/config";
import { translateText, cancelAllTranslations } from '@/entrypoints/utils/translateApi';

let hoverTimer: any; // 鼠标悬停计时器
let htmlSet = new Set(); // 防抖
export let originalContents = new Map(); // 保存原始内容
let isAutoTranslating = false; // 控制是否继续翻译新内容
let observer: IntersectionObserver | null = null; // 保存观察器实例
let mutationObserver: MutationObserver | null = null; // 保存 DOM 变化观察器实例

// 使用自定义属性标记已翻译的节点
const TRANSLATED_ATTR = 'data-fr-translated';
const TRANSLATED_ID_ATTR = 'data-fr-node-id'; // 添加节点ID属性
const PROCESSING_ATTR = 'data-fr-processing';

let nodeIdCounter = 0; // 节点ID计数器

// 仅在文本足够长时依据语言检测决定是否跳过
function shouldSkipByLanguage(text: string): boolean {
    const clean = (text || '').replace(/[\s\u3000]/g, '');
    if (clean.length < 20) return false; // 短文本不做语言跳过判断，避免误判
    try {
        const lang = detectlang(clean);
        return lang === config.to;
    } catch {
        return false;
    }
}

// 恢复原文内容
export function restoreOriginalContent() {
    // 取消所有等待中的翻译任务
    cancelAllTranslations();
    
    // 1. 遍历所有已翻译的节点
    document.querySelectorAll(`[${TRANSLATED_ATTR}="true"]`).forEach(node => {
        const nodeId = node.getAttribute(TRANSLATED_ID_ATTR);
        if (nodeId && originalContents.has(nodeId)) {
            const originalContent = originalContents.get(nodeId);
            node.innerHTML = originalContent;
            node.removeAttribute(TRANSLATED_ATTR);
            node.removeAttribute(TRANSLATED_ID_ATTR);
            node.removeAttribute(PROCESSING_ATTR);
            
            // 移除可能添加的翻译相关类
            (node as Element).classList.remove('fluent-read-bilingual');
        }
    });
    
    // 2. 移除所有翻译内容元素
    document.querySelectorAll('.fluent-read-bilingual-content').forEach(element => {
        element.remove();
    });
    
    // 3. 移除所有翻译过程中添加的加载动画和错误提示
    document.querySelectorAll('.fluent-read-loading, .fluent-read-retry-wrapper').forEach(element => {
        element.remove();
    });
    
    // 4. 清空存储的原始内容
    originalContents.clear();
    
    // 5. 停止所有观察器
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
    
    // 6. 重置所有翻译相关的状态
    isAutoTranslating = false;
    htmlSet.clear(); // 清空防抖集合
    nodeIdCounter = 0; // 重置节点ID计数器
    
    // 7. 消除可能存在的全局样式污染
    const tempStyleElements = document.querySelectorAll('style[data-fr-temp-style]');
    tempStyleElements.forEach(el => el.remove());
}

// 自动翻译整个页面的功能
export function autoTranslateEnglishPage() {
    // 如果已经在翻译中，则返回
    if (isAutoTranslating) return;
    
    // 获取需要翻译的节点
    const rawNodes = grabAllNode(document.body);
    console.log(`[FluentRead] 找到 ${rawNodes.length} 个节点需要翻译`);
    
    // 规范化：若节点是容器且含多个块级段落，则改为子段落集合
    const nodes = Array.from(new Set(rawNodes.flatMap((n: Element) => {
        const blocks = getBlockChildrenWithText(n as Element);
        return blocks.length >= 2 ? blocks : [n];
    })));
    if (!nodes.length) return;

    isAutoTranslating = true;

    // 创建观察器
    observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && isAutoTranslating) {
                const node = entry.target as Element;

                // 去重：正在处理中或已翻译则跳过
                if (node.hasAttribute(PROCESSING_ATTR) || node.getAttribute(TRANSLATED_ATTR) === 'true') return;
                
                // 为节点分配唯一ID
                const nodeId = `fr-node-${nodeIdCounter++}`;
                node.setAttribute(TRANSLATED_ID_ATTR, nodeId);
                
                // 保存原始内容
                originalContents.set(nodeId, node.innerHTML);
                
                // 标记处理中
                node.setAttribute(PROCESSING_ATTR, 'true');

                const finish = (success: boolean) => {
                    node.removeAttribute(PROCESSING_ATTR);
                    if (success) node.setAttribute(TRANSLATED_ATTR, 'true');
                };

                const onError = () => finish(false);

                if (config.display === styles.bilingualTranslation) {
                    // 执行双语翻译，并在内部回调成功后设置 translated
                    bilingualTranslate(node, undefined, finish, onError);
                } else {
                    singleTranslate(node, finish, onError);
                }

                // 停止观察该节点
                observer.unobserve(node);
            }
        });
    }, {
        root: null,
        rootMargin: '50px',
        threshold: 0.1 // 只要出现10%就开始翻译
    });

    // 开始观察所有节点
    nodes.forEach(node => {
        observer?.observe(node);
    });

    // 创建 MutationObserver 监听 DOM 变化
    mutationObserver = new MutationObserver((mutations) => {
        if (!isAutoTranslating) return;
        
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // 元素节点
                    // 只处理未翻译的新节点
                    const newNodesRaw = grabAllNode(node as Element).filter(
                        n => n.getAttribute(TRANSLATED_ATTR) !== 'true' && !n.hasAttribute(PROCESSING_ATTR)
                    );
                    const newNodes = Array.from(new Set(newNodesRaw.flatMap((n: Element) => {
                        const blocks = getBlockChildrenWithText(n as Element);
                        return blocks.length >= 2 ? blocks : [n];
                    })));
                    newNodes.forEach(n => observer?.observe(n));
                }
            });
        });
    });

    // 监听整个 body 的变化
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}


// 处理鼠标悬停翻译的主函数
export function handleTranslation(mouseX: number, mouseY: number, delayTime: number = 0) {
    // 检查配置
    if (!checkConfig()) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {

        let node = grabNode(document.elementFromPoint(mouseX, mouseY));

        // 判断是否跳过节点
        if (skipNode(node)) return;

        // 防抖
        let nodeOuterHTML = node.outerHTML;
        if (htmlSet.has(nodeOuterHTML)) return;
        htmlSet.add(nodeOuterHTML);

        // 根据翻译模式进行翻译
        if (config.display === styles.bilingualTranslation) {
            handleBilingualTranslation(node, delayTime > 0);  // 根据 delayTime 可判断是否为滑动翻译
        } else {
            handleSingleTranslation(node, delayTime > 0);
        }
    }, delayTime);
}

// 识别直接子级中的块级段落元素
function getBlockChildrenWithText(node: Element): Element[] {
    const blockTags = new Set(['p','li','dd','blockquote','h1','h2','h3','h4','h5','h6','figcaption']);
    // 查找 node 下的顶层块级段落元素（不是简单的直系子元素，适配 Reddit 等嵌套结构）
    const all = Array.from(node.querySelectorAll('p,li,dd,blockquote,h1,h2,h3,h4,h5,h6,figcaption')) as Element[];
    const topLevel = all.filter((el) => {
        // 过滤掉被其它块级元素包裹的后代，只保留相对顶层（直到 node）
        let parent = el.parentElement;
        while (parent && parent !== node) {
            if (blockTags.has(parent.tagName.toLowerCase())) return false;
            parent = parent.parentElement;
        }
        return true;
    });
    return topLevel.filter((el) => ((el.textContent || '').trim().length >= 1));
}

// 双语翻译
export function handleBilingualTranslation(node: any, slide: boolean) {
    let nodeOuterHTML = node.outerHTML;

    // 若父节点有多个块级段落子元素，拆分为子段落分别翻译
    const blockChildren = getBlockChildrenWithText(node as Element);
    if (blockChildren.length >= 2) {
        blockChildren.forEach((child) => bilingualTranslate(child));
        htmlSet.delete(nodeOuterHTML);
        return;
    }

    // 若块级节点仅包含单个按钮式链接，则直接翻译按钮文本并返回，避免在父节点追加译文
    const onlyChild = (node.children && node.children.length === 1) ? node.children[0] as Element : null;
    if (onlyChild) {
        const tag = onlyChild.tagName?.toLowerCase?.();
        if (tag === 'a' || tag === 'button' || onlyChild.getAttribute?.('role') === 'button') {
            if ((onlyChild.textContent || '').trim()) {
                handleBtnTranslation(onlyChild);
                htmlSet.delete(nodeOuterHTML);
                return;
            }
        }
    }

    // 如果已经翻译过，250ms 后删除翻译结果
    let bilingualNode = searchClassName(node, 'fluent-read-bilingual');
    if (bilingualNode) {
        if (slide) {
            htmlSet.delete(nodeOuterHTML);
            return;
        }
        let spinner = insertLoadingSpinner(bilingualNode as HTMLElement, true);
        setTimeout(() => {
            spinner.remove();
            const content = searchClassName(bilingualNode as HTMLElement, 'fluent-read-bilingual-content');
            if (content && content instanceof HTMLElement) content.remove();
            (bilingualNode as HTMLElement).classList.remove('fluent-read-bilingual');
            htmlSet.delete(nodeOuterHTML);
        }, 250);
        return;
    }

    // 检查是否有缓存
    let cached = cache.localGet(node.textContent);
    if (cached) {
        let spinner = insertLoadingSpinner(node, true);
        setTimeout(() => {
            spinner.remove();
            htmlSet.delete(nodeOuterHTML);
            bilingualAppendChild(node, cached);
        }, 250);
        return;
    }

    // 翻译
    bilingualTranslate(node, nodeOuterHTML);
}

// 单语翻译
export function handleSingleTranslation(node: any, slide: boolean) {
    let nodeOuterHTML = node.outerHTML;
    let outerHTMLCache = cache.localGet(node.outerHTML);

    // 若父节点有多个块级段落子元素，拆分为子段落分别翻译
    const blockChildren = getBlockChildrenWithText(node as Element);
    if (blockChildren.length >= 2) {
        blockChildren.forEach((child) => singleTranslate(child));
        htmlSet.delete(nodeOuterHTML);
        return;
    }

    // 链接/按钮类元素优先按按钮文本方式翻译，避免改变结构
    const tag = node.tagName?.toLowerCase?.();
    if (tag === 'a' || tag === 'button' || node.getAttribute?.('role') === 'button') {
        handleBtnTranslation(node);
        return;
    }

    if (outerHTMLCache) {
        // handleTranslation 已处理防抖 故删除判断 原bug 在保存完成后 刷新页面 可以取得缓存 直接return并没有翻译
        let spinner = insertLoadingSpinner(node, true);
        setTimeout(() => {
            spinner.remove();
            htmlSet.delete(nodeOuterHTML);

            // 兼容部分网站独特的 DOM 结构
            let fn = replaceCompatFn[getMainDomain(document.location.hostname)];
            if (fn) fn(node, outerHTMLCache);
            else node.outerHTML = outerHTMLCache;

        }, 250);
        return;
    }

    singleTranslate(node);
}


function bilingualTranslate(node: any, nodeOuterHTML?: any, onFinish?: (s: boolean)=>void, onError?: ()=>void) {
    if (shouldSkipByLanguage(node.textContent)) { onFinish?.(false); return; }

    // 若当前节点包含多个块级段落子元素，则改为“按子段落批量翻译并逐一挂载”
    const blockChildren = getBlockChildrenWithText(node as Element);
    if (blockChildren.length >= 2) {
        const parts = blockChildren.map((el) => (el.textContent || '').trim());
        const originJoined = parts.join('\n%%\n');
        const spinner = insertLoadingSpinner(node);
        translateText(originJoined, document.title)
            .then((resp: string) => {
                spinner.remove();
                if (nodeOuterHTML) htmlSet.delete(nodeOuterHTML);
                const translatedParts = resp.split(/\s*%%\s*/).filter(s => s.length > 0);
                const count = Math.min(blockChildren.length, translatedParts.length);
                for (let i = 0; i < count; i++) {
                    const child = blockChildren[i];
                    child.classList.add('fluent-read-bilingual');
                    const newNode = document.createElement('span');
                    newNode.classList.add('fluent-read-bilingual-content');
                    const style = options.styles.find(s => s.value === config.style && !s.disabled);
                    if (style?.class) newNode.classList.add(style.class);
                    newNode.append(translatedParts[i]);
                    smashTruncationStyle(child);
                    child.appendChild(newNode);
                }
                onFinish?.(count > 0);
            })
            .catch((error: Error) => {
                spinner.remove();
                insertFailedTip(node, error.toString() || '翻译失败', spinner);
                if ((error?.message || '').includes('Extension context invalidated')) {
                    console.warn('[FluentRead] 扩展后台已卸载或重启，建议刷新页面后再试');
                }
                onError?.();
            });
        return;
    }

    let origin = node.textContent;
    let spinner = insertLoadingSpinner(node);
    
    // 使用队列管理的翻译API
    translateText(origin, document.title)
        .then((text: string) => {
            spinner.remove();
            if (nodeOuterHTML) htmlSet.delete(nodeOuterHTML);
            // 如果译文与原文相同（或非常短），尝试改用仅译文模式再翻一次，避免双语模式下的不生效感
            if (!text || text.trim() === (node.textContent || '').trim()) {
                singleTranslate(node, onFinish, onError);
                return;
            }
            bilingualAppendChild(node, text);
            onFinish?.(true);
        })
        .catch((error: Error) => {
            spinner.remove();
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
            if ((error?.message || '').includes('Extension context invalidated')) {
                console.warn('[FluentRead] 扩展后台已卸载或重启，建议刷新页面后再试');
            }
            onError?.();
        });
}


export function singleTranslate(node: any, onFinish?: (s: boolean)=>void, onError?: ()=>void) {
    if (shouldSkipByLanguage(node.textContent)) { onFinish?.(false); return; }

    let origin: string;
    if (servicesType.isMachine(config.service)) {
        // 对段落类容器优先取纯文本，避免大量 HTML 干扰机器翻译
        const tag = node.tagName?.toLowerCase?.();
        origin = (tag === 'div' || tag === 'p' || tag === 'li' || tag?.startsWith('h'))
            ? (node.textContent || '')
            : node.innerHTML;
    } else {
        origin = LLMStandardHTML(node);
    }
    let spinner = insertLoadingSpinner(node);
    
    // 使用队列管理的翻译API
    translateText(origin, document.title)
        .then((text: string) => {
            spinner.remove();
            
            text = beautyHTML(text);
            
            if (!text || origin === text) { onFinish?.(false); return; }
            
            let oldOuterHtml = node.outerHTML;
            node.innerHTML = text;
            let newOuterHtml = node.outerHTML;
            
            // 缓存翻译结果
            cache.localSetDual(oldOuterHtml, newOuterHtml);
            cache.set(htmlSet, newOuterHtml, 250);
            htmlSet.delete(oldOuterHtml);
            onFinish?.(true);
        })
        .catch((error: Error) => {
            spinner.remove();
            insertFailedTip(node, error.toString() || "翻译失败", spinner);
            if ((error?.message || '').includes('Extension context invalidated')) {
                console.warn('[FluentRead] 扩展后台已卸载或重启，建议刷新页面后再试');
            }
            onError?.();
        });
}

export const handleBtnTranslation = throttle((node: any) => {
    const origin = node.innerText;
    const cached = cache.localGet(origin);
    if (cached) {
        node.innerText = cached;
        return;
    }

    // 通过统一的翻译队列发送请求，避免全局节流导致的漏翻
    translateText(origin, document.title)
        .then((text: string) => {
            if (text && text !== origin) {
                cache.localSetDual(origin, text);
                node.innerText = text;
            }
        })
        .catch((error: any) => console.error('按钮/链接翻译失败:', error));
}, 250)


function bilingualAppendChild(node: any, text: string) {
    // 若译文包含段落分隔符，则与子块级段落一一对应追加
    const parts = text.split(/\s*%%\s*/).filter(p => p.length > 0);
    const blockChildren = getBlockChildrenWithText(node as Element);

    if (parts.length > 1 && blockChildren.length >= parts.length) {
        blockChildren.slice(0, parts.length).forEach((child, idx) => {
            child.classList.add('fluent-read-bilingual');
            const newNode = document.createElement('span');
            newNode.classList.add('fluent-read-bilingual-content');
            const style = options.styles.find(s => s.value === config.style && !s.disabled);
            if (style?.class) newNode.classList.add(style.class);
            newNode.append(parts[idx]);
            smashTruncationStyle(child);
            child.appendChild(newNode);
        });
        return;
    }

    // 其次：尝试按 <br> 分段映射
    if (parts.length > 1) {
        const brs = Array.from(node.querySelectorAll('br')) as HTMLElement[];
        if (brs.length + 1 >= parts.length) {
            // 在每个段落结束的 <br> 后插入译文，最后一段追加在容器末尾
            for (let i = 0; i < parts.length; i++) {
                const newNode = document.createElement('span');
                newNode.classList.add('fluent-read-bilingual-content');
                const style = options.styles.find(s => s.value === config.style && !s.disabled);
                if (style?.class) newNode.classList.add(style.class);
                newNode.append(parts[i]);
                if (i < brs.length) {
                    brs[i].insertAdjacentElement('afterend', newNode);
                } else {
                    node.appendChild(newNode);
                }
            }
            node.classList.add('fluent-read-bilingual');
            return;
        }
    }

    node.classList.add("fluent-read-bilingual");
    let newNode = document.createElement("span");
    newNode.classList.add("fluent-read-bilingual-content");
    // find the style
    const style = options.styles.find(s => s.value === config.style && !s.disabled);
    if (style?.class) {
        newNode.classList.add(style.class);
    }
    newNode.append(text);
    smashTruncationStyle(node);
    node.appendChild(newNode);
}

// 监听配置变化后，适度清理已缓存但未标记为已翻译的节点，避免服务切换后局部不翻
try {
    storage.watch && storage.watch('local:config', (newValue: any) => {
        try {
            const pendingNodes = Array.from(document.querySelectorAll('*:not([data-fr-translated])')) as Element[];
            // 清除轻量缓存影响
            pendingNodes.slice(0, 200).forEach(n => {
                cache.localRemove(n.outerHTML || n.textContent || '');
            });
        } catch {}
    });
} catch {}