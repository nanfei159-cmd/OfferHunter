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

    // 岗位列表容器（用于遍历卡片和定位按钮）
    // 猎聘改版后class为驼峰式jobCardPcContainer（无连字符），非旧版job-card-pc-container
    public static final String JOB_CARDS = "div[class*='jobCardPcContainer']";

    // 聊天相关元素（改版后聊天为独立ant-im弹窗组件，而非__im_basic__老版结构）
    public static final String CHAT_HEADER = ".ant-im-modal, .im-ui-basic-chat-modal";
    public static final String CHAT_CLOSE = "span[aria-label='close']";
    // 聊天输入框：placeholder="请输入文字，按Enter键发送"
    public static final String CHAT_INPUT = "textarea.im-ui-textarea";
    // "发简历"直接投递按钮
    public static final String RESUME_BTN = ".action-resume";
}