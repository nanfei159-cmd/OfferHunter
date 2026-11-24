package com.getjobs.application.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

/**
 * 启动时补齐猎聘相关表结构。
 * <p>
 * release 里的空库模板是旧版结构：liepin_config 没有 say_hi/company_scale/debugger，
 * liepin_data 没有详情页字段。MyBatis-Plus 会按实体全字段查询，缺列会直接报
 * "no such column"，所以必须在任何查询之前补齐。
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class DbMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureLiepinConfig();
        ensureLiepinData();
        ensureLiepinOption();
    }

    private void ensureLiepinConfig() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS liepin_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    debugger INTEGER DEFAULT 0,
                    keywords VARCHAR(500),
                    city VARCHAR(200),
                    salary_code VARCHAR(200),
                    company_scale VARCHAR(200),
                    recruiter_type VARCHAR(20) DEFAULT 'all',
                    reapply_after_days INTEGER DEFAULT 1,
                    title_exclude VARCHAR(500) DEFAULT '销售,客户经理,大客户,BD,业务员,招商,电销,营销',
                    say_hi TEXT,
                    send_say_hi INTEGER DEFAULT 1,
                    same_hr_filter INTEGER DEFAULT 1,
                    publish_within_days INTEGER DEFAULT 90,
                    hr_active_within_days INTEGER DEFAULT 30,
                    publish_age_buckets TEXT,
                    hr_active_buckets TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )""");
        addColumnIfMissing("liepin_config", "debugger", "INTEGER DEFAULT 0");
        addColumnIfMissing("liepin_config", "company_scale", "VARCHAR(200)");
        addColumnIfMissing("liepin_config", "recruiter_type", "VARCHAR(20) DEFAULT 'all'");
        addColumnIfMissing("liepin_config", "reapply_after_days", "INTEGER DEFAULT 1");
        addColumnIfMissing("liepin_config", "title_exclude", "VARCHAR(500) DEFAULT '销售,客户经理,大客户,BD,业务员,招商,电销,营销'");
        // 旧版默认排除词把“业务/商务”当排除词，误伤仓储业务经理、配送业务负责人等
        // 运营管理岗。只迁移仍是旧默认值的配置，用户自己改过的不动。
        jdbcTemplate.update("UPDATE liepin_config SET title_exclude = ? WHERE title_exclude = ?",
                "销售,客户经理,大客户,BD,业务员,招商,电销,营销",
                "销售,业务,BD,客户经理,商务");
        addColumnIfMissing("liepin_config", "say_hi", "TEXT");
        addColumnIfMissing("liepin_config", "send_say_hi", "INTEGER DEFAULT 1");
        addColumnIfMissing("liepin_config", "same_hr_filter", "INTEGER DEFAULT 1");
        addColumnIfMissing("liepin_config", "publish_within_days", "INTEGER DEFAULT 90");
        addColumnIfMissing("liepin_config", "hr_active_within_days", "INTEGER DEFAULT 30");
        addColumnIfMissing("liepin_config", "publish_age_buckets", "TEXT");
        addColumnIfMissing("liepin_config", "hr_active_buckets", "TEXT");
    }

    private void ensureLiepinData() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS liepin_data (
                    job_id BIGINT PRIMARY KEY,
                    job_title VARCHAR(200),
                    job_link VARCHAR(300),
                    job_salary_text VARCHAR(100),
                    job_area VARCHAR(100),
                    job_edu_req VARCHAR(50),
                    job_exp_req VARCHAR(50),
                    job_publish_time VARCHAR(50),
                    comp_id BIGINT,
                    comp_name VARCHAR(200),
                    comp_industry VARCHAR(100),
                    comp_scale VARCHAR(50),
                    hr_id VARCHAR(64),
                    hr_name VARCHAR(50),
                    hr_title VARCHAR(100),
                    hr_im_id VARCHAR(64),
                    hr_active_status TEXT,
                    job_description TEXT,
                    recruitment_status TEXT,
                    delivered INTEGER DEFAULT 0,
                    delivered_at DATETIME,
                    stage VARCHAR(20) DEFAULT 'discovered',
                    stage_reason VARCHAR(500),
                    create_time DATETIME,
                    update_time DATETIME
                )""");
        addColumnIfMissing("liepin_data", "hr_active_status", "TEXT");
        addColumnIfMissing("liepin_data", "job_description", "TEXT");
        addColumnIfMissing("liepin_data", "recruitment_status", "TEXT");
        addColumnIfMissing("liepin_data", "delivered_at", "DATETIME");
        addColumnIfMissing("liepin_data", "stage", "VARCHAR(20) DEFAULT 'discovered'");
        addColumnIfMissing("liepin_data", "stage_reason", "VARCHAR(500)");
        // 老库里已投递的岗位归到 applied，避免分析页把它们显示成未处理
        jdbcTemplate.update("UPDATE liepin_data SET stage='applied' WHERE delivered=1 AND (stage IS NULL OR stage='discovered')");
    }

    private void ensureLiepinOption() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS liepin_option (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    code TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    sort_order INTEGER
                )""");
    }

    private void addColumnIfMissing(String table, String column, String type) {        Set<String> columns = new HashSet<>(jdbcTemplate.query(
                "PRAGMA table_info(" + table + ")",
                (rs, rowNum) -> rs.getString("name")));
        if (!columns.contains(column)) {
            jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + type);
            log.info("数据库迁移：{}.{} 已添加", table, column);
        }
    }
}
