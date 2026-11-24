package com.getjobs.worker.liepin;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * 逐岗招呼语。每次投递开始时读取 greetings.json（job_id -> 招呼语）。
 * 文件不存在或损坏时返回空表，调用方回退到全局 sayHi。
 *
 * 查找顺序：
 * 1. %APPDATA%\GetJobs Liepin\greetings.json（招呼语工厂的默认输出）
 * 2. 当前工作目录/greetings.json（桌面版 cwd 也是数据目录；开发模式可放 repo 根目录）
 */
@Slf4j
public final class GreetingStore {
    private static final String FILE_NAME = "greetings.json";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private GreetingStore() {
    }

    public static Map<Long, String> load() {
        Path file = resolveFile();
        if (file == null) {
            return Collections.emptyMap();
        }
        return load(file);
    }

    static Map<Long, String> load(Path file) {
        try {
            Map<String, String> raw = MAPPER.readValue(
                    file.toFile(), new TypeReference<Map<String, String>>() {
                    });
            Map<Long, String> result = new HashMap<>();
            raw.forEach((key, value) -> {
                if (key == null || value == null || value.isBlank()) {
                    return;
                }
                try {
                    result.put(Long.parseLong(key.trim()), value.trim());
                } catch (NumberFormatException e) {
                    log.warn("忽略非数字 job_id: {}", key);
                }
            });
            log.info("已加载逐岗招呼语 {} 条: {}", result.size(), file.toAbsolutePath());
            return result;
        } catch (IOException e) {
            log.warn("读取 {} 失败，回退到全局招呼语: {}", file.toAbsolutePath(), e.getMessage());
            return Collections.emptyMap();
        }
    }

    private static Path resolveFile() {
        String appData = System.getenv("APPDATA");
        if (appData != null && !appData.isBlank()) {
            Path roaming = Paths.get(appData, "GetJobs Liepin", FILE_NAME);
            if (Files.isRegularFile(roaming)) {
                return roaming;
            }
        }
        Path cwd = Paths.get(FILE_NAME);
        return Files.isRegularFile(cwd) ? cwd : null;
    }
}
