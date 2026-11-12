package com.getjobs.worker.liepin;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 猎聘时间/活跃度解析。
 * <p>
 * 真实数据格式：
 * - job_publish_time: 20261026110417（14 位）
 * - hr_active_status: 当前在线 / 5小时前在线 / 3天前在线
 * - recruitment_status: 招1人 · 10月26日更新 / 90天前更新
 */
public final class LiepinTimeUtils {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final Pattern ABS_MD = Pattern.compile("(\\d{1,2})月(\\d{1,2})日");
    private static final Pattern P_DAYS = Pattern.compile("(\\d+)\\s*天");
    private static final Pattern P_WEEKS = Pattern.compile("(\\d+)\\s*周");
    private static final Pattern P_MONTHS = Pattern.compile("(\\d+)\\s*个?月");
    private static final Pattern P_HOURS = Pattern.compile("(\\d+)\\s*小时");
    private static final Pattern P_MINUTES = Pattern.compile("(\\d+)\\s*分钟");

    private LiepinTimeUtils() {
    }

    /** 发布时间距今多少天；解析不出返回 null（不误杀） */
    public static Integer daysSincePublish(String raw, LocalDateTime now) {
        if (raw == null || raw.isBlank()) return null;
        LocalDateTime t = parseAbsolute(raw, now);
        if (t != null) return daysBetween(t, now);
        return parseRelativeDays(raw, now);
    }

    /** HR 最近活跃距今多少天；解析不出返回 null（不误杀） */
    public static Integer daysSinceActive(String raw, LocalDateTime now) {
        if (raw == null || raw.isBlank()) return null;
        return parseRelativeDays(raw, now);
    }

    /** 招聘状态里的更新时间距今多少天；用于发布时间缺失时兜底 */
    public static Integer daysSinceUpdate(String raw, LocalDateTime now) {
        if (raw == null || raw.isBlank()) return null;
        Integer relative = parseRelativeDays(raw, now);
        if (relative != null) return relative;
        LocalDateTime t = parseAbsolute(raw, now);
        return t == null ? null : daysBetween(t, now);
    }

    /** 发布时间档位：0-30 / 31-60 / 61-90 / 91-180 / 180+ */
    public static String publishBucket(Integer age) {
        if (age == null) return null;
        if (age <= 30) return "0-30";
        if (age <= 60) return "31-60";
        if (age <= 90) return "61-90";
        if (age <= 180) return "91-180";
        return "180+";
    }

    /** HR 活跃档位：now / 3d / week / 2w / month / 3m / older */
    public static String activeBucket(Integer age) {
        if (age == null) return null;
        if (age <= 0) return "now";
        if (age <= 3) return "3d";
        if (age <= 7) return "week";
        if (age <= 14) return "2w";
        if (age <= 30) return "month";
        if (age <= 90) return "3m";
        return "older";
    }

    private static LocalDateTime parseAbsolute(String raw, LocalDateTime now) {
        String s = raw.trim();
        try {
            if (s.matches("\\d{14}")) return LocalDateTime.parse(s, TS);
            if (s.matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}")) return LocalDateTime.parse(s, DT);
            if (s.matches("\\d{4}-\\d{2}-\\d{2}")) return LocalDate.parse(s, D).atStartOfDay();
        } catch (DateTimeParseException ignored) {
            // 继续尝试其它格式
        }

        Matcher m = ABS_MD.matcher(s);
        if (m.find()) {
            try {
                int month = Integer.parseInt(m.group(1));
                int day = Integer.parseInt(m.group(2));
                LocalDateTime candidate = LocalDateTime.of(now.getYear(), month, day, 0, 0);
                // 只写了月日：如果比现在还晚，说明是去年的
                if (candidate.isAfter(now)) candidate = candidate.minusYears(1);
                return candidate;
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private static Integer parseRelativeDays(String raw, LocalDateTime now) {
        String s = raw.trim();
        if (s.isEmpty()) return null;

        // 分钟/小时级：不足 1 天
        if (P_MINUTES.matcher(s).find() || P_HOURS.matcher(s).find()) return 0;

        // 10月26日更新：绝对日期，必须先于“X个月”匹配
        Matcher md = ABS_MD.matcher(s);
        if (md.find()) {
            try {
                int month = Integer.parseInt(md.group(1));
                int day = Integer.parseInt(md.group(2));
                LocalDateTime candidate = LocalDateTime.of(now.getYear(), month, day, 0, 0);
                if (candidate.isAfter(now)) candidate = candidate.minusYears(1);
                return daysBetween(candidate, now);
            } catch (Exception ignored) {
                return null;
            }
        }

        Matcher m = P_DAYS.matcher(s);
        if (m.find()) return Integer.parseInt(m.group(1));
        m = P_WEEKS.matcher(s);
        if (m.find()) return Integer.parseInt(m.group(1)) * 7;
        m = P_MONTHS.matcher(s);
        if (m.find()) return Integer.parseInt(m.group(1)) * 30;

        if (s.contains("半年前") || s.contains("近半年") || s.contains("半年内")) return 180;
        if (s.contains("年前")) return 365;
        if (s.contains("3日内") || s.contains("三天内")) return 3;
        if (s.contains("2周内") || s.contains("两周内")) return 14;
        if (s.contains("本周") || s.contains("一周内")) return 7;
        if (s.contains("本月")) return 30;
        if (s.contains("昨日") || s.contains("昨天")) return 1;
        if (s.contains("今日") || s.contains("今天")
                || s.contains("当前") || s.contains("刚刚")
                || s.contains("在线") || s.contains("活跃")) return 0;
        return null;
    }

    private static int daysBetween(LocalDateTime t, LocalDateTime now) {
        long days = Duration.between(t, now).toDays();
        return days < 0 ? 0 : (int) days;
    }

    // ponytail: 没有测试框架，留一个可运行的 main 自检
    public static void main(String[] args) {
        LocalDateTime now = LocalDateTime.of(2026, 11, 12, 12, 0);
        check("publish timestamp", daysSincePublish("20261026110417", now), 17);
        checkTrue("old publish", daysSincePublish("20250113202349", now) > 90);
        check("active current", daysSinceActive("当前在线", now), 0);
        check("active minutes", daysSinceActive("44分钟前在线", now), 0);
        check("active hours", daysSinceActive("5小时前在线", now), 0);
        check("active days", daysSinceActive("3天前在线", now), 3);
        check("active half year", daysSinceActive("半年前活跃", now), 180);
        check("update days", daysSinceUpdate("招1人 · 90天前更新", now), 90);
        check("update month-day", daysSinceUpdate("招1人 · 10月26日更新", now), 17);
        check("unknown", daysSinceActive("不知道", now), null);
        checkText("bucket 30", publishBucket(30), "0-30");
        checkText("bucket 31", publishBucket(31), "31-60");
        checkText("bucket 90", publishBucket(90), "61-90");
        checkText("bucket 91", publishBucket(91), "91-180");
        checkText("bucket 181", publishBucket(181), "180+");
        checkText("active now", activeBucket(0), "now");
        checkText("active 3d", activeBucket(3), "3d");
        checkText("active week", activeBucket(5), "week");
        checkText("active month", activeBucket(30), "month");
        checkText("active older", activeBucket(91), "older");
        System.out.println("LiepinTimeUtils self-check OK");
    }

    private static void check(String name, Integer actual, Integer expected) {
        if (actual == null ? expected != null : !actual.equals(expected)) {
            throw new AssertionError(name + ": expected " + expected + ", got " + actual);
        }
    }

    private static void checkTrue(String name, boolean condition) {
        if (!condition) throw new AssertionError(name);
    }

    private static void checkText(String name, String actual, String expected) {
        if (actual == null ? expected != null : !actual.equals(expected)) {
            throw new AssertionError(name + ": expected " + expected + ", got " + actual);
        }
    }
}
