package com.getjobs.application.service;

import com.getjobs.application.entity.LiepinConfigEntity;
import com.getjobs.application.service.LiepinService;
import com.getjobs.worker.liepin.LiepinConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 配置服务类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConfigService {
    private final LiepinService liepinService;

    /**
     * 统一入口：从专表 liepin_config 读取并构建 LiepinConfig
     * 说明：每个平台维持专表，由 ConfigService 暴露统一读取方法供 Worker 使用。
     */
    public LiepinConfig getLiepinConfig() {
        LiepinConfigEntity entity = liepinService.getFirstConfig();

        LiepinConfig config = new LiepinConfig();

        config.setDebugger(entity != null && entity.getDebugger() != null && entity.getDebugger() == 1);

        // 关键词解析：支持逗号、中文逗号、或 [a,b] 格式
        config.setKeywords(parseBracketList(entity != null ? entity.getKeywords() : null));

        // 公司规模筛选：同样支持 [a,b] 格式，为空表示不限
        config.setCompanyScale(parseBracketList(entity != null ? entity.getCompanyScale() : null));

        // 城市：支持 [深圳,广州] 多选；允许名称或代码；全国/空表示不限
        java.util.List<String> cityCodes = new java.util.ArrayList<>();
        java.util.List<String> cityNames = new java.util.ArrayList<>();
        if (entity != null && entity.getCity() != null && !entity.getCity().isBlank()) {
            for (String raw : parseBracketList(entity.getCity())) {
                String item = raw.trim();
                if (item.isEmpty()) continue;
                String name = liepinService.normalizeCityToName(item);
                if (name == null || name.isEmpty()) continue;
                if ("全国".equals(name)) {
                    cityCodes.clear();
                    cityNames.clear();
                    break;
                }
                String code = liepinService.getCodeByTypeAndName("city", name);
                if (code == null || code.isEmpty()) {
                    // 如果数据库还没同步到该名称，尝试把原值当代码再查一次
                    String nameByCode = liepinService.getNameByTypeAndCode("city", item);
                    if (nameByCode != null && !nameByCode.isEmpty() && !nameByCode.equals(item)) {
                        name = nameByCode;
                        code = item;
                    }
                }
                if (code == null || code.isEmpty()) {
                    throw new IllegalArgumentException("未在数据库中找到城市编码: " + item);
                }
                if (!cityCodes.contains(code)) {
                    cityCodes.add(code);
                    cityNames.add(name);
                }
            }
        }
        config.setCityCodes(cityCodes);
        config.setCityNames(cityNames);

        // 薪资代码：支持中文名或代码
        String salaryCode = entity != null ? entity.getSalaryCode() : null;
        if (salaryCode == null || salaryCode.isBlank()) {
            config.setSalary("");
        } else {
            String codeByName = liepinService.getCodeByTypeAndName("salary", salaryCode.trim());
            config.setSalary((codeByName != null && !codeByName.isEmpty()) ? codeByName : salaryCode.trim());
        }

        config.setSayHi(entity != null ? entity.getSayHi() : null);
        // 旧库没有这两个字段时按默认值处理：补发招呼语开启、同一 HR 过滤开启
        config.setSendSayHi(entity == null || entity.getSendSayHi() == null || entity.getSendSayHi() == 1);
        config.setSameHrFilter(entity == null || entity.getSameHrFilter() == null || entity.getSameHrFilter() == 1);
        // 活跃度过滤：发布时间默认 90 天，HR 活跃默认 30 天；0 表示不限
        config.setPublishWithinDays(entity == null || entity.getPublishWithinDays() == null ? 90 : entity.getPublishWithinDays());
        config.setHrActiveWithinDays(entity == null || entity.getHrActiveWithinDays() == null ? 30 : entity.getHrActiveWithinDays());

        // 多选档位：null 表示旧配置，继续用上面的单阈值；空列表表示用户明确选择“不限”
        String publishBucketsRaw = entity != null ? entity.getPublishAgeBuckets() : null;
        config.setPublishAgeBuckets(publishBucketsRaw == null ? null : parseBracketList(publishBucketsRaw));
        String hrBucketsRaw = entity != null ? entity.getHrActiveBuckets() : null;
        config.setHrActiveBuckets(hrBucketsRaw == null ? null : parseBracketList(hrBucketsRaw));

        return config;
    }

    /** 解析 "[a,b]" 或 "a,b" 或 "a，b" 格式的列表字符串，空/null 返回空列表 */
    private java.util.List<String> parseBracketList(String raw) {
        java.util.List<String> result = new java.util.ArrayList<>();
        if (raw == null) return result;
        String s = raw.trim().replace('，', ',');
        if (s.startsWith("[") && s.endsWith("]")) {
            s = s.substring(1, s.length() - 1);
        }
        for (String t : s.split(",")) {
            String v = t.trim().replaceAll("^\"|\"$", "");
            if (!v.isEmpty()) result.add(v);
        }
        return result;
    }
}
