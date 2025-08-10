/**
 * X.com/Twitter "显示更多"功能的正确处理方案
 * 
 * 核心思路：
 * 1. 监听"显示更多"按钮点击
 * 2. 内容展开后主动触发翻译
 * 3. 记录已翻译状态，避免重复
 */

import { translateText } from '@/entrypoints/utils/translateApi';
import { config } from '@/entrypoints/utils/config';
import { styles } from '@/entrypoints/utils/constant';
import { options } from '@/entrypoints/utils/option';

// 存储已翻译的推文
const translatedTweets = new WeakMap<Element, {
    isExpanded: boolean;
    lastTranslatedText: string;
}>();

/**
 * 监听并处理X.com的"显示更多"按钮
 */
export function handleXShowMore(): void {
    // 只在X.com/Twitter上运行
    if (!window.location.hostname.includes('x.com') && 
        !window.location.hostname.includes('twitter.com')) {
        return;
    }

    console.log('[FluentRead] X.com "显示更多"处理器已启动');

    // 使用事件委托监听所有点击事件
    document.addEventListener('click', async (event) => {
        const target = event.target as Element;
        
        // 检查是否点击了"显示更多"按钮
        if (!isShowMoreButton(target)) {
            return;
        }

        console.log('[FluentRead] 检测到"显示更多"按钮点击');

        // 找到包含这个按钮的推文容器
        const tweetContainer = findTweetContainer(target);
        if (!tweetContainer) {
            return;
        }

        // 等待内容展开完成
        await waitForContentExpansion(tweetContainer);

        // 触发重新翻译
        await retranslateTweet(tweetContainer);
    }, true); // 使用捕获阶段，确保在React处理之前捕获事件

    // 同时监听DOM变化，处理动态加载的内容
    observeTweetChanges();
}

/**
 * 判断元素是否为"显示更多"按钮
 */
function isShowMoreButton(element: Element): boolean {
    // 检查元素本身
    const text = element.textContent?.trim();
    if (text === 'Show more' || text === '显示更多') {
        return true;
    }

    // 检查父元素（span的父div可能是按钮）
    const parent = element.parentElement;
    if (parent?.getAttribute('role') === 'button') {
        const parentText = parent.textContent?.trim();
        if (parentText === 'Show more' || parentText === '显示更多') {
            return true;
        }
    }

    return false;
}

/**
 * 找到包含按钮的推文容器
 */
function findTweetContainer(element: Element): Element | null {
    // 向上查找推文容器
    return element.closest('[data-testid="tweet"], article[role="article"], article');
}

/**
 * 等待内容展开完成
 */
async function waitForContentExpansion(tweetContainer: Element): Promise<void> {
    console.log('[FluentRead] 等待内容展开...');
    
    return new Promise((resolve) => {
        let resolved = false;
        let checkCount = 0;
        const maxChecks = 30; // 最多检查3秒
        
        const checkInterval = setInterval(() => {
            checkCount++;
            
            // 方法1：检查是否还有"Show more"按钮
            const showMoreBtn = tweetContainer.querySelector('[role="button"]');
            const btnText = showMoreBtn?.textContent?.trim();
            
            // 如果没有"Show more"按钮，或者出现了"Show less"按钮，说明已展开
            if (!btnText?.includes('Show more') && !btnText?.includes('显示更多')) {
                console.log('[FluentRead] 内容已展开（按钮消失）');
                clearInterval(checkInterval);
                if (!resolved) {
                    resolved = true;
                    // 额外等待一下让React完成渲染
                    setTimeout(() => resolve(), 300);
                }
                return;
            }
            
            // 方法2：检查文本内容长度是否增加
            const textElement = tweetContainer.querySelector('[data-testid="tweetText"], div[lang]');
            const currentText = textElement?.textContent || '';
            if (currentText.length > 500) { // 长文本通常超过500字符
                console.log('[FluentRead] 检测到长文本，可能已展开');
                clearInterval(checkInterval);
                if (!resolved) {
                    resolved = true;
                    setTimeout(() => resolve(), 300);
                }
                return;
            }
            
            // 超时处理
            if (checkCount >= maxChecks) {
                console.log('[FluentRead] 等待超时，继续处理');
                clearInterval(checkInterval);
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            }
        }, 100);
    });
}

/**
 * 重新翻译推文
 */
async function retranslateTweet(tweetContainer: Element): Promise<void> {
    console.log('[FluentRead] 准备重新翻译展开后的推文');

    // 查找推文文本容器 - 更准确的选择器
    let textElement = tweetContainer.querySelector('[data-testid="tweetText"]');
    if (!textElement) {
        textElement = tweetContainer.querySelector('div[lang][dir="auto"]');
    }
    if (!textElement) {
        // 尝试查找包含大量文本的div
        const divs = tweetContainer.querySelectorAll('div[dir="auto"]');
        for (const div of divs) {
            const text = div.textContent || '';
            if (text.length > 100 && !text.includes('Follow')) {
                textElement = div;
                break;
            }
        }
    }
    
    if (!textElement) {
        console.warn('[FluentRead] 找不到推文文本容器');
        return;
    }

    console.log('[FluentRead] 找到文本容器:', textElement);

    // 检查是否已经被翻译过
    const isAlreadyTranslated = textElement.classList.contains('fluent-read-bilingual') ||
                                textElement.getAttribute('data-fr-translated') === 'true';
    
    if (isAlreadyTranslated) {
        console.log('[FluentRead] 节点已被翻译，先清理旧翻译');
        
        // 移除翻译标记
        textElement.classList.remove('fluent-read-bilingual');
        textElement.removeAttribute('data-fr-translated');
        textElement.removeAttribute('data-fr-node-id');
        
        // 移除翻译内容
        const oldTranslations = textElement.querySelectorAll('.fluent-read-bilingual-content');
        oldTranslations.forEach(el => el.remove());
        
        // 等待DOM更新
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 获取纯净的原文文本（不包含翻译）
    const fullText = extractPureText(textElement);
    console.log('[FluentRead] 提取的纯文本长度:', fullText.length);
    console.log('[FluentRead] 纯文本内容:', fullText.substring(0, 200) + '...');
    
    if (!fullText || fullText.length < 10) {
        console.warn('[FluentRead] 文本太短或为空');
        return;
    }

    // 检查是否已经翻译过相同的内容
    const cached = translatedTweets.get(tweetContainer);
    if (cached?.lastTranslatedText === fullText) {
        console.log('[FluentRead] 内容未变化，跳过翻译');
        return;
    }

    console.log('[FluentRead] 开始翻译...');

    try {
        // 翻译新内容
        const translatedText = await translateText(fullText, document.title);
        
        console.log('[FluentRead] 翻译结果:', translatedText?.substring(0, 100) + '...');
        
        if (!translatedText || translatedText === fullText) {
            console.warn('[FluentRead] 翻译失败或结果与原文相同');
            return;
        }

        // 添加翻译结果
        if (config.display === styles.bilingualTranslation) {
            // 双语模式：在原文后添加译文
            textElement.classList.add('fluent-read-bilingual');
            textElement.setAttribute('data-fr-translated', 'true');
            
            const translationElement = document.createElement('span');
            translationElement.classList.add('fluent-read-bilingual-content');
            
            // 应用样式
            const style = options.styles.find(s => s.value === config.style && !s.disabled);
            if (style?.class) {
                translationElement.classList.add(style.class);
            }
            
            // 保持段落结构 - 检测原文中的段落分隔
            // X.com 使用<br>或<span>来分隔段落
            const paragraphs = translatedText.split('\n').filter(p => p.trim().length > 0);
            
            // 创建包含段落结构的HTML
            if (paragraphs.length > 1) {
                // 多段落文本，使用div包装每个段落
                const container = document.createElement('div');
                container.style.display = 'block';
                container.style.marginTop = '0.5em';
                
                paragraphs.forEach((paragraph, index) => {
                    const p = document.createElement('div');
                    p.textContent = paragraph.trim();
                    if (index > 0) {
                        p.style.marginTop = '1em'; // 段落间距
                    }
                    container.appendChild(p);
                });
                
                translationElement.appendChild(container);
            } else {
                // 单段落文本
                translationElement.textContent = translatedText;
            }
            
            textElement.appendChild(translationElement);
        } else {
            // 单语模式：替换原文
            // 保存原文以便恢复
            const originalHTML = textElement.innerHTML;
            textElement.setAttribute('data-original-content', originalHTML);
            textElement.innerHTML = translatedText;
        }

        // 记录翻译状态
        translatedTweets.set(tweetContainer, {
            isExpanded: true,
            lastTranslatedText: fullText
        });

        console.log('[FluentRead] 推文翻译完成');

    } catch (error) {
        console.error('[FluentRead] 翻译失败:', error);
        console.error('[FluentRead] 错误详情:', {
            message: (error as any)?.message,
            stack: (error as any)?.stack
        });
    }
}

/**
 * 提取纯净的原文文本（排除已有的翻译）
 */
function extractPureText(element: Element): string {
    // 克隆节点以避免修改原始DOM
    const clone = element.cloneNode(true) as Element;
    
    // 移除所有翻译内容
    clone.querySelectorAll('.fluent-read-bilingual-content').forEach(el => el.remove());
    
    // 移除按钮和UI元素
    clone.querySelectorAll('[role="button"], time, [data-testid*="User"]').forEach(el => el.remove());
    
    // 获取纯文本
    let text = clone.textContent?.trim() || '';
    
    // 清理文本
    text = text
        .replace(/Show more/gi, '')
        .replace(/Show less/gi, '')
        .replace(/显示更多/g, '')
        .replace(/收起/g, '')
        .trim();
    
    // 如果文本中包含明显的中文翻译模式，尝试提取原文
    // X.com的双语显示通常是原文后直接跟着翻译
    const lines = text.split('\n');
    const cleanLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 检查是否为中文翻译行（如果原文是英文）
        const hasEnglish = /[a-zA-Z]/.test(line);
        const hasChinese = /[\u4e00-\u9fa5]/.test(line);
        
        // 如果是纯中文行且前一行是英文，可能是翻译，跳过
        if (hasChinese && !hasEnglish && i > 0) {
            const prevLine = lines[i - 1]?.trim();
            if (prevLine && /^[a-zA-Z\s\d\-\?\.\,\!\@\#\$\%\^\&\*\(\)\_\+\=\[\]\{\}\;\:\'\"\<\>\/\\\|]+$/.test(prevLine)) {
                continue; // 跳过翻译行
            }
        }
        
        cleanLines.push(line);
    }
    
    return cleanLines.join('\n').trim();
}

/**
 * 提取完整文本
 */
function extractFullText(element: Element): string {
    // 方法1：直接获取文本内容（最简单）
    let text = element.textContent?.trim() || '';
    
    // 清理文本：移除UI元素文本
    text = text
        .replace(/Show more/gi, '')
        .replace(/Show less/gi, '')
        .replace(/显示更多/g, '')
        .replace(/收起/g, '')
        .trim();
    
    console.log('[FluentRead] 提取的原始文本:', text);
    
    // 如果文本太短，尝试其他方法
    if (text.length < 50) {
        // 方法2：遍历所有文本节点
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    
                    // 排除按钮和UI元素
                    if (parent.getAttribute('role') === 'button' ||
                        parent.matches('time, [data-testid*="User"], a[href*="/status/"]')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    const nodeText = node.textContent?.trim() || '';
                    // 排除特定文本
                    if (nodeText === 'Show more' || nodeText === '显示更多' ||
                        nodeText === 'Show less' || nodeText === '收起') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        
        const textParts: string[] = [];
        let node;
        while (node = walker.nextNode()) {
            const nodeText = node.textContent?.trim();
            if (nodeText && nodeText.length > 0) {
                textParts.push(nodeText);
            }
        }
        
        text = textParts.join(' ').trim();
        console.log('[FluentRead] 通过TreeWalker提取的文本:', text);
    }
    
    return text;
}

/**
 * 监听推文DOM变化
 */
function observeTweetChanges(): void {
    // 创建观察器监听新推文
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        
                        // 检查是否有新的"显示更多"按钮
                        const showMoreButtons = element.querySelectorAll('[role="button"]');
                        showMoreButtons.forEach(btn => {
                            const text = btn.textContent?.trim();
                            if (text === 'Show more' || text === '显示更多') {
                                // 为新按钮添加标记
                                btn.setAttribute('data-show-more-btn', 'true');
                            }
                        });
                    }
                });
            }
        }
    });

    // 监听整个页面
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * 主动检查并翻译已展开的推文
 * 用于处理页面加载时已经展开的内容
 */
export async function checkAndTranslateExpandedTweets(): Promise<void> {
    const tweets = document.querySelectorAll('[data-testid="tweet"], article');
    
    for (const tweet of tweets) {
        // 检查是否有"Show more"按钮
        const showMoreBtn = tweet.querySelector('[role="button"]');
        const btnText = showMoreBtn?.textContent?.trim();
        
        // 如果没有"Show more"按钮，说明内容已展开或本来就是完整的
        if (!btnText?.includes('Show more') && !btnText?.includes('显示更多')) {
            const textElement = tweet.querySelector('[data-testid="tweetText"], div[lang]');
            if (textElement) {
                // 检查是否已经翻译
                const hasTranslation = textElement.querySelector('.fluent-read-bilingual-content');
                if (!hasTranslation) {
                    // 获取文本长度，只处理较长的推文
                    const text = extractFullText(textElement);
                    if (text.length > 280) { // Twitter的字符限制
                        await retranslateTweet(tweet);
                    }
                }
            }
        }
    }
}