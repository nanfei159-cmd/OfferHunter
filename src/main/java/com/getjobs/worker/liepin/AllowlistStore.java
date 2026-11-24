package com.getjobs.worker.liepin;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 投递白名单。文件存在时，只处理 allowlist.json 里的 job_id；文件不存在时不过滤。
 * 空数组表示不投任何岗位；文件损坏也按空表处理，避免误投。
 *
 * 查找顺序：
 * 1. %APPDATA%\GetJobs Liepin\allowlist.json
 * 2. 当前工作目录/allowlist.json
 */
@Slf4j
public final class AllowlistStore {
    private static final String FILE_NAME = "allowlist.json";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private AllowlistStore() {
    }

    /**
     * 文件不存在返回 null（不过滤）；文件存在返回 job_id 集合（可能为空）。
     */
    public static Set<Long> load() {
        Path file = resolveFile();
        if (file == null) {
            return null;
        }
        try {
            List<Object> raw = MAPPER.readValue(file.toFile(), new TypeReference<List<Object>>() {
            });
            Set<Long> result = new HashSet<>();
            for (Object item : raw) {
                if (item == null) {
                    continue;
                }
                try {
                    result.add(Long.parseLong(item.toString().trim()));
                } catch (NumberFormatException e) {
                    log.warn("忽略非数字 allowlist 项: {}", item);
                }
            }
            log.info("已加载 allowlist {} 条: {}", result.size(), file.toAbsolutePath());
            return result;
        } catch (IOException e) {
            log.warn("读取 {} 失败，allowlist 按空表处理（不投）: {}", file.toAbsolutePath(), e.getMessage());
            return Collections.emptySet();
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
