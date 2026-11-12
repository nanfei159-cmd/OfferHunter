package com.getjobs.application.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * 启动时把猎聘城市选项同步到 liepin_option。
 * 旧库只有 14 个热门城市；资源文件里有完整城市码，新增/更新都幂等。
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class LiepinCitySeed implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        InputStream in = getClass().getResourceAsStream("/liepin-cities.tsv");
        if (in == null) {
            log.warn("未找到城市种子文件 /liepin-cities.tsv，跳过城市选项同步");
            return;
        }

        int inserted = 0;
        int updated = 0;
        int order = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            boolean header = true;
            while ((line = reader.readLine()) != null) {
                if (header) {
                    header = false;
                    continue;
                }
                if (line.isBlank()) continue;
                String[] parts = line.split("\t");
                if (parts.length < 2) continue;
                String name = parts[0].trim();
                String code = parts[1].trim();
                if (name.isEmpty() || code.isEmpty()) continue;

                order++;
                int count = jdbcTemplate.update(
                        "UPDATE liepin_option SET code = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE type = 'city' AND name = ?",
                        code, order, name);
                if (count == 0) {
                    count = jdbcTemplate.update(
                            "UPDATE liepin_option SET name = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE type = 'city' AND code = ?",
                            name, order, code);
                }
                if (count == 0) {
                    jdbcTemplate.update(
                            "INSERT INTO liepin_option(type, name, code, sort_order) VALUES ('city', ?, ?, ?)",
                            name, code, order);
                    inserted++;
                } else {
                    updated++;
                }
            }
        } catch (Exception e) {
            log.warn("同步猎聘城市选项失败: {}", e.getMessage());
        }
        log.info("猎聘城市选项同步完成：新增 {} 个，更新 {} 个，共 {} 个", inserted, updated, order);
    }
}
