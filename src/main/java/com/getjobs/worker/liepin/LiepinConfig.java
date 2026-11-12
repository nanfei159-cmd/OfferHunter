package com.getjobs.worker.liepin;

import lombok.Data;

import java.util.List;

/**
 * @author loks666
 * 项目链接: <a href="https://github.com/loks666/get_jobs">https://github.com/loks666/get_jobs</a>
 */
@Data
public class LiepinConfig {
    /**
     * 开发者模式
     */
    private Boolean debugger;

    /**
     * 搜索关键词列表
     */
    private List<String> keywords;

    /**
     * 城市编码列表；为空表示全国/不限
     */
    private List<String> cityCodes;

    /**
     * 城市名称列表，与 cityCodes 一一对应，用于投递前按城市名前缀二次过滤
     */
    private List<String> cityNames;

    /**
     * 薪资范围
     */
    private String salary;

    /**
     * 打招呼语：聊一聊后在输入框补发的自定义文案
     */
    private String sayHi;

    /**
     * 是否补发自定义招呼语。猎聘点「聊一聊」会先发账号默认招呼语，
     * 这里再发 sayHi 会变成两条；已在猎聘设置过默认招呼语时应关闭。
     */
    private Boolean sendSayHi;

    /**
     * 同一 HR 只打一次招呼（同一 HR 发布多个岗位时，避免重复发消息）
     */
    private Boolean sameHrFilter;

    /** 发布时间不超过多少天；0 或 null 表示不限 */
    private Integer publishWithinDays;

    /** HR 最近活跃不超过多少天；0 或 null 表示不限 */
    private Integer hrActiveWithinDays;

    /** 发布时间多选档位；null 表示用 publishWithinDays 旧阈值，空列表表示不限 */
    private List<String> publishAgeBuckets;

    /** HR 活跃多选档位；null 表示用 hrActiveWithinDays 旧阈值，空列表表示不限 */
    private List<String> hrActiveBuckets;

    /**
     * 公司规模筛选（如 100-499人），为空表示不限。
     * 猎聘搜索接口不支持按规模硬过滤，这里在投递前用已抓取到的 compScale 字段二次校验
     */
    private List<String> companyScale;

}
