package com.getjobs.worker.liepin;

/**
 * 猎聘网页元素定位器
 * 集中管理所有页面元素的定位表达式
 */
public class Locators {
    // 搜索结果页相关元素（分页与弹窗）
    public static final String PAGINATION_BOX = ".list-pagination-box";
    // Ant Design v5 中下一页为 li.ant-pagination-next 内的按钮
    public static final String NEXT_PAGE = "li.ant-pagination-next";
    public static final String SUBSCRIBE_CLOSE_BTN = "div[class*='subscribe-close-btn']";
    // 投递成功后的「为你推荐以下职位」弹窗，右下角一键投递推荐岗位
    public static final String ONE_CLICK_RESUME_BTN =
            "button:has-text('一键发简历'), a:has-text('一键发简历'), [role='button']:has-text('一键发简历')";

    // 岗位列表容器（用于遍历卡片和定位按钮）
    // 猎聘在两种改版之间来回切：驼峰式 jobCardPcContainer 和连字符式 job-card-pc-container。
    // 两种都保留，避免站点一改版就整页找不到卡片。
    public static final String JOB_CARDS = "div[class*='jobCardPcContainer'], div[class*='job-card-pc-container']";

    // 聊天相关元素。猎聘有弹窗、右侧抽屉、独立标签页三种形态，
    // 只认弹窗会把「继续聊」的抽屉当成没打开，岗位白白漏投。
    // textarea 是最终兜底：搜索页本身没有可见 textarea，出现即说明聊天框已就绪。
    public static final String CHAT_HEADER = ".ant-im-modal, .im-ui-basic-chat-modal, .im-ui-basic-chat-container, [class*='im-ui-basic-chat'], textarea";
    // 关闭按钮的容器限定为弹窗/抽屉，不能用 CHAT_HEADER（可能匹配到 textarea）
    public static final String CHAT_CONTAINER = ".ant-im-modal, .im-ui-basic-chat-modal, .im-ui-basic-chat-container, [class*='im-ui-basic-chat']";
    public static final String CHAT_CLOSE = "span[aria-label='close']";
    // 聊天输入框：placeholder="请输入文字，按Enter键发送"
    public static final String CHAT_INPUT = "textarea.im-ui-textarea";
    // "发简历"直接投递按钮
    public static final String RESUME_BTN = ".action-resume";
}