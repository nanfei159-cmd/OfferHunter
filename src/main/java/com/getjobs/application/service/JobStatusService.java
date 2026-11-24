package com.getjobs.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;

/**
 * 投递状态落库。
 * <p>
 * 只保留投递链路需要的四个状态：发现、已投、失败、跳过。
 * 匹配评分/审批流水线已移除；已投以 delivered=1 为准，stage 只做展示。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JobStatusService {

    public enum Status {
        discovered, applied, failed, skipped
    }

    private final JdbcTemplate jdbcTemplate;

    public void mark(Long jobId, Status status, String reason) {
        if (jobId == null || status == null) return;
        try {
            jdbcTemplate.update(
                    "UPDATE liepin_data SET stage=?, stage_reason=?, update_time=? WHERE job_id=?",
                    status.name(), trim(reason), Timestamp.valueOf(LocalDateTime.now()), jobId);
        } catch (Exception e) {
            log.debug("更新投递状态失败: jobId={}, status={}, {}", jobId, status, e.getMessage());
        }
    }

    private String trim(String reason) {
        if (reason == null) return null;
        return reason.length() > 500 ? reason.substring(0, 500) : reason;
    }
}
