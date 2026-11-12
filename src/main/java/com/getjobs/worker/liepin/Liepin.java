package com.getjobs.worker.liepin;

import com.getjobs.worker.utils.PlaywrightUtil;
import com.getjobs.application.service.LiepinService;
import com.getjobs.application.entity.LiepinEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.options.WaitForSelectorState;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;

// 移除保存页面源码相关的导入
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

import static com.getjobs.worker.liepin.Locators.*;


/**
 * @author loks666
 * 项目链接: <a href="https://github.com/loks666/get_jobs">https://github.com/loks666/get_jobs</a>
 */
@Slf4j
@Component
@Scope("prototype")
public class Liepin {
    static {
        // 在类加载时就设置日志文件名，确保Logger初始化时能获取到正确的属性
        System.setProperty("log.name", "liepin");
    }

    private int maxPage = 50;
    private final List<String> resultList = new ArrayList<>();
    private final List<LiepinEntity> lastApiEntities = new ArrayList<>();
    // 本次运行已经打过招呼的 HR，避免同一个 HR 的多个岗位重复发消息
    private final Set<String> greetedHrKeys = new HashSet<>();
    private boolean monitoringRegistered = false;
    private String targetCityName;
    private Integer salaryMinK;
    private Integer salaryMaxK;
    @Setter
    private LiepinConfig config;
    @Getter
    private Date startDate;
    @Setter
    private Page page;
    @Autowired
    private LiepinService liepinService;

    public interface ProgressCallback {
        void onProgress(String message, Integer current, Integer total);
    }

    @Setter
    private ProgressCallback progressCallback;
    @Setter
    private Supplier<Boolean> shouldStopCallback;

    public void prepare() {
        this.startDate = new Date();
        this.resultList.clear();
        this.greetedHrKeys.clear();

        // 监控猎聘接口请求与返回，输出被拦截的URL（精确匹配PC搜索相关接口）
        if (page != null && !monitoringRegistered) {
            // 请求拦截日志（仅搜索岗位接口）
            page.onRequest(req -> {
                try {
                    String url = req.url();
                    if (url != null && url.contains("com.liepin.searchfront4c.pc-search-job")
                            && !url.contains("com.liepin.searchfront4c.pc-search-job-cond-init")) {
                        // log.info("[拦截][请求] {}", url);
                    }
                } catch (Exception ignored) {}
            });
            page.onResponse((Response response) -> {
                try {
                    String url = response.url();
                    if (url != null && response.status() == 200 &&
                            url.contains("com.liepin.searchfront4c.pc-search-job") &&
                            !url.contains("com.liepin.searchfront4c.pc-search-job-cond-init")) {
                        log.info("[拦截][响应] {}", url);
                        String contentType = null;
                        try { contentType = response.headers().get("content-type"); } catch (Exception ignored) {}
                        if (contentType == null || contentType.contains("application/json")) {
                            String text = response.text();
                            if (text != null && !text.isEmpty()) {
                                // 尝试解析，若结构不符合则在方法内直接返回
                                parseAndPersistLiepinData(text);
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("监控猎聘接口响应时发生错误: {}", e.getMessage());
                }
            });
            monitoringRegistered = true;
        }
    }

    public int execute() {
        if (page == null) {
            throw new IllegalStateException("Liepin.page 未设置");
        }
        if (config == null) {
            throw new IllegalStateException("Liepin.config 未设置");
        }

        // 在开始执行前确保已注册接口监听
        prepare();

        // 城市配置支持多选：逐个城市搜索；未配置或选择“全国”时只跑一次全国
        List<CityTarget> cityTargets = resolveCityTargets();
        if (cityTargets.size() > 1) {
            info(String.format("本次将依次搜索 %d 个城市", cityTargets.size()));
        }
        // salaryCode同样是软过滤，搜索链接带了15$30，返回结果里还是会混入10-13k这种完全不搭边的岗位，
        // 需要用抓到的薪资文本二次校验
        resolveSalaryRange();

        List<String> keywords = config.getKeywords();
        if (keywords == null || keywords.isEmpty()) {
            log.warn("未配置关键词，执行结束");
            return 0;
        }

        for (String keyword : keywords) {
            if (shouldStop()) {
                info("收到停止指令，提前结束关键词循环");
                break;
            }
            for (CityTarget city : cityTargets) {
                if (shouldStop()) {
                    info("收到停止指令，提前结束城市循环");
                    break;
                }
                try {
                    submit(keyword, city);
                } catch (Exception e) {
                    log.warn("关键词【{}】城市【{}】投递过程异常，跳过继续下一个: {}", keyword,
                            city.name() == null ? "全国" : city.name(), e.getMessage());
                }
            }
        }
        return resultList.size();
    }

    /** 一次搜索的目标城市；code 为空、name 为 null 表示全国/不限 */
    private record CityTarget(String code, String name) {}

    // ========== 解析接口JSON并保存到数据库 ==========
    private void parseAndPersistLiepinData(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(json);
            // 兼容两种结构：data.data.jobCardList 或 data.jobCardList
            JsonNode cardList = root.path("data").path("data").path("jobCardList");
            if (!cardList.isArray()) {
                cardList = root.path("data").path("jobCardList");
            }
            if (!cardList.isArray()) {
                return;
            }
            lastApiEntities.clear();
            for (JsonNode item : cardList) {
                JsonNode job = item.path("job");
                JsonNode comp = item.path("comp");
                JsonNode recruiter = item.path("recruiter");

                Long jobId = readLong(job.path("jobId"));
                if (jobId == null) {
                    continue;
                }

                LiepinEntity entity = new LiepinEntity();
                entity.setJobId(jobId);
                entity.setJobTitle(readText(job.path("title")));
                entity.setJobLink(readText(job.path("link")));
                entity.setJobSalaryText(readText(job.path("salary")));
                entity.setJobArea(readText(job.path("dq")));
                entity.setJobEduReq(readText(job.path("requireEduLevel")));
                entity.setJobExpReq(readText(job.path("requireWorkYears")));
                entity.setJobPublishTime(readText(job.path("refreshTime")));

                entity.setCompId(readLong(comp.path("compId")));
                entity.setCompName(readText(comp.path("compName")));
                entity.setCompIndustry(readText(comp.path("compIndustry")));
                entity.setCompScale(readText(comp.path("compScale")));

                entity.setHrId(readText(recruiter.path("recruiterId")));
                entity.setHrName(readText(recruiter.path("recruiterName")));
                entity.setHrTitle(readText(recruiter.path("recruiterTitle")));
                entity.setHrImId(readText(recruiter.path("imId")));

                // 缓存到内存供页面投递显示使用（避免从页面读取文本），这里不按城市过滤，
                // 保留全部卡片是为了让后面按DOM顺序/jobId匹配卡片时不会错位
                lastApiEntities.add(entity);
            }
            // 批量持久化：仅不存在时插入，默认 delivered=0。
            // 猎聘搜索接口的city/dq/salaryCode都是软排序信号而非硬过滤，返回结果会混入外地、规模不对、
            // 薪资完全不搭边的岗位——这些岗位从不会真正进入投递流程，存进库里就是纯垃圾数据，会污染
            // "投递分析"页的统计和列表，所以持久化这一步就过滤掉，而不是等投递时才跳过
            java.util.List<LiepinEntity> toPersist = lastApiEntities;
            if (targetCityName != null || hasCompanyScaleFilter() || hasSalaryFilter()) {
                toPersist = new java.util.ArrayList<>();
                for (LiepinEntity e : lastApiEntities) {
                    boolean cityOk = targetCityName == null
                            || (e.getJobArea() != null && e.getJobArea().startsWith(targetCityName));
                    boolean scaleOk = matchesCompanyScale(e.getCompScale());
                    boolean salaryOk = matchesSalaryRange(e.getJobSalaryText());
                    if (cityOk && scaleOk && salaryOk) {
                        toPersist.add(e);
                    }
                }
            }
            try {
                liepinService.insertSnapshotsIfNotExistsBatch(toPersist);
            } catch (Exception e) {
                log.warn("批量保存猎聘岗位数据失败: {}", e.getMessage());
            }
        } catch (Exception e) {
            log.warn("解析猎聘JSON失败: {}", e.getMessage());
        }
    }

    private String readText(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String v = node.asText();
        return (v == null || v.isEmpty()) ? null : v;
    }

    private Long readLong(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        try {
            if (node.isNumber()) {
                long v = node.asLong();
                return v == 0 ? null : v;
            }
            if (node.isTextual()) {
                String t = node.asText();
                if (t == null || t.isEmpty()) return null;
                long v = Long.parseLong(t.trim());
                return v == 0 ? null : v;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String safeText(String s) {
        if (s == null) return null;
        return s.replaceAll("\n", " ").replaceAll("【 ", "[").replaceAll(" 】", "]");
    }

    /** 同一 HR 的稳定标识：优先 recruiterId，其次 imId，最后姓名 */
    private String hrKeyOf(LiepinEntity e) {
        if (e == null) return null;
        if (e.getHrId() != null && !e.getHrId().isBlank()) return "id:" + e.getHrId();
        if (e.getHrImId() != null && !e.getHrImId().isBlank()) return "im:" + e.getHrImId();
        if (e.getHrName() != null && !e.getHrName().isBlank()) return "name:" + e.getHrName();
        return null;
    }

    private boolean shouldStop() {
        return shouldStopCallback != null && Boolean.TRUE.equals(shouldStopCallback.get());
    }

    /** 关闭订阅推荐弹窗（如果出现）。弹窗残留会挡住后续卡片点击，必须在每次操作前兜底关闭一次 */
    private void closeSubscribePopupIfPresent() {
        try {
            Locator closeBtn = page.locator(SUBSCRIBE_CLOSE_BTN);
            if (closeBtn.count() > 0) {
                closeBtn.first().click(new Locator.ClickOptions().setForce(true).setTimeout(3000));
            }
        } catch (Exception ignored) {
        }
    }

    /**
     * 解析配置的目标城市列表；空列表或“全国”视为不限，返回一个 code 为空的全国任务。
     */
    private List<CityTarget> resolveCityTargets() {
        List<String> codes = config.getCityCodes();
        List<String> names = config.getCityNames();
        if (codes == null || codes.isEmpty()) {
            return List.of(new CityTarget("", null));
        }
        List<CityTarget> targets = new ArrayList<>();
        for (int i = 0; i < codes.size(); i++) {
            String code = codes.get(i);
            String name = names != null && i < names.size() ? names.get(i) : null;
            if (name == null || name.isBlank()) {
                try {
                    name = liepinService.normalizeCityToName(code);
                } catch (Exception ignored) {
                    name = null;
                }
            }
            if (name == null || name.isBlank() || "全国".equals(name)) {
                return List.of(new CityTarget("", null));
            }
            targets.add(new CityTarget(code, name));
        }
        return targets.isEmpty() ? List.of(new CityTarget("", null)) : targets;
    }

    /** 解析配置的薪资范围（如 "15$30" -> 15~30，单位K），格式不对或未配置则视为不限 */
    private void resolveSalaryRange() {
        salaryMinK = null;
        salaryMaxK = null;
        String raw = config.getSalary();
        if (raw == null || raw.isBlank()) return;
        String[] parts = raw.trim().split("\\$");
        if (parts.length != 2) return;
        try {
            salaryMinK = Integer.parseInt(parts[0].trim());
            salaryMaxK = Integer.parseInt(parts[1].trim());
        } catch (NumberFormatException ignored) {
            salaryMinK = null;
            salaryMaxK = null;
        }
    }

    private boolean hasSalaryFilter() {
        return salaryMinK != null && salaryMaxK != null;
    }

    /**
     * 薪资是否命中筛选：只要岗位薪资区间和配置区间有交集就算命中（而不是要求岗位区间整个落在配置区间内），
     * 和猎聘自己筛选框的语义一致。未配置筛选、或岗位薪资文本解析不出数字时都视为命中（拿不到信息不赌它不合适，保守放行）
     */
    private boolean matchesSalaryRange(String jobSalaryText) {
        if (!hasSalaryFilter()) return true;
        if (jobSalaryText == null || jobSalaryText.isBlank()) return true;
        // "10-13k"、"17-25k·13薪"、"15-30k·15薪" 这类格式，取第一个"-"两侧最近的数字
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)").matcher(jobSalaryText);
        if (!m.find()) return true;
        try {
            double jobMin = Double.parseDouble(m.group(1));
            double jobMax = Double.parseDouble(m.group(2));
            // 有些岗位薪资单位是"元/天"而不是K，数值会大得离谱（几百上千），这种解析不出可靠的K值，保守放行
            if (jobMax > 300) return true;
            return jobMax >= salaryMinK && jobMin <= salaryMaxK;
        } catch (NumberFormatException e) {
            return true;
        }
    }

    private boolean hasCompanyScaleFilter() {
        return config.getCompanyScale() != null && !config.getCompanyScale().isEmpty();
    }

    /** 公司规模是否命中筛选；未配置筛选时视为全部命中 */
    private boolean matchesCompanyScale(String compScale) {
        if (!hasCompanyScaleFilter()) return true;
        if (compScale == null || compScale.isEmpty()) return false;
        return config.getCompanyScale().contains(compScale.trim());
    }

    /** 发布时间是否命中：多选档位优先；旧配置回退到单阈值 */
    private boolean isPublishAllowed(Integer age) {
        if (age == null) return true;
        List<String> buckets = config.getPublishAgeBuckets();
        if (buckets != null) {
            if (buckets.isEmpty()) return true;
            String bucket = LiepinTimeUtils.publishBucket(age);
            return bucket != null && buckets.contains(bucket);
        }
        Integer max = config.getPublishWithinDays();
        return max == null || max <= 0 || age <= max;
    }

    /** HR 活跃度是否命中：多选档位优先；旧配置回退到单阈值 */
    private boolean isHrActiveAllowed(Integer age) {
        if (age == null) return true;
        List<String> buckets = config.getHrActiveBuckets();
        if (buckets != null) {
            if (buckets.isEmpty()) return true;
            String bucket = LiepinTimeUtils.activeBucket(age);
            return bucket != null && buckets.contains(bucket);
        }
        Integer max = config.getHrActiveWithinDays();
        return max == null || max <= 0 || age <= max;
    }

    /** 按jobId匹配接口返回的实体（卡片顺序和接口返回顺序可能不一致），匹配不到再退化用下标 */
    private LiepinEntity resolveApiEntity(Long cardJobId, int index) {
        if (cardJobId != null) {
            for (LiepinEntity e : lastApiEntities) {
                if (cardJobId.equals(e.getJobId())) return e;
            }
        }
        return index < lastApiEntities.size() ? lastApiEntities.get(index) : null;
    }

    /** 详情页补充字段：岗位描述、HR活跃状态、招聘状态（人数+更新时间拼接） */
    private record JobDetailInfo(String jobDescription, String hrActiveStatus, String recruitmentStatus) {}

    /**
     * 打开岗位详情页抓取列表接口里没有的字段，用完即关，不影响主列表页。
     * 注：公司地址、融资阶段、公司介绍猎聘详情页压根不展示，抓不到，前端对应列固定留空。
     */
    private JobDetailInfo fetchLiepinJobDetail(String jobLink) {
        Page detailPage = null;
        try {
            detailPage = page.context().newPage();
            detailPage.navigate(jobLink, new Page.NavigateOptions().setTimeout(15000).setWaitUntil(com.microsoft.playwright.options.WaitUntilState.DOMCONTENTLOADED));
            detailPage.waitForSelector("dd[data-selector='job-intro-content']", new Page.WaitForSelectorOptions().setTimeout(8000));

            String jobDescription = null;
            Locator descLocator = detailPage.locator("dd[data-selector='job-intro-content']");
            if (descLocator.count() > 0) {
                jobDescription = descLocator.first().textContent();
            }

            String hrActiveStatus = null;
            Locator onlineLocator = detailPage.locator(".recruiter-container .name-box .online");
            if (onlineLocator.count() > 0) {
                hrActiveStatus = onlineLocator.first().textContent();
            }

            String recruitCnt = null;
            Locator recruitCntLocator = detailPage.locator(".recruit-cnt");
            if (recruitCntLocator.count() > 0) {
                recruitCnt = recruitCntLocator.first().textContent();
            }
            String updateTime = null;
            Locator updateTimeLocator = detailPage.locator(".update-time");
            if (updateTimeLocator.count() > 0) {
                updateTime = updateTimeLocator.first().textContent();
            }
            StringBuilder statusSb = new StringBuilder();
            if (recruitCnt != null && !recruitCnt.isBlank()) statusSb.append(recruitCnt.trim());
            if (updateTime != null && !updateTime.isBlank()) {
                if (statusSb.length() > 0) statusSb.append(" · ");
                statusSb.append(updateTime.trim());
            }

            return new JobDetailInfo(
                    jobDescription != null ? jobDescription.trim() : null,
                    hrActiveStatus != null ? hrActiveStatus.trim() : null,
                    statusSb.length() > 0 ? statusSb.toString() : null
            );
        } catch (Exception e) {
            log.debug("打开猎聘岗位详情页失败: {} | {}", jobLink, e.getMessage());
            return null;
        } finally {
            if (detailPage != null) {
                try { detailPage.close(); } catch (Exception ignore) {}
            }
        }
    }

    private void info(String msg) {
        if (progressCallback != null) {
            progressCallback.onProgress(msg, null, null);
        } else {
            log.info(msg);
        }
    }

    private void submit(String keyword, CityTarget city) {
        // 每个城市单独设置，供接口数据持久化和投递前二次过滤使用
        targetCityName = city.name();
        // 清洗关键词：去掉前后引号与多余空白
        String cleanKeyword = keyword == null ? "" : keyword.replace("\"", "").trim();
        // 中文关键词必须URL编码，否则猎聘会把请求当无效搜索处理，重定向回首页推荐流
        String encodedKeyword = java.net.URLEncoder.encode(cleanKeyword, java.nio.charset.StandardCharsets.UTF_8);
        String finalUrl = getSearchUrl(city.code()) + "&key=" + encodedKeyword;
        log.info("【诊断】cityCode={}，salary={}，最终搜索URL: {}", city.code(), config.getSalary(), finalUrl);
        page.navigate(finalUrl);

        // 等待分页元素加载
        page.waitForSelector(PAGINATION_BOX, new Page.WaitForSelectorOptions().setTimeout(10000));
        Locator paginationBox = page.locator(PAGINATION_BOX);
        Locator lis = paginationBox.locator("li");
        setMaxPage(lis);
        String cityLabel = city.name() == null ? "" : "·" + city.name();

        for (int i = 0; i < maxPage; i++) {
            if (shouldStop()) {
                info("收到停止指令，结束分页循环");
                return;
            }
            closeSubscribePopupIfPresent();

        // 等待岗位卡片挂载（不要求可见，避免因遮挡造成超时）
        try {
            page.waitForSelector(
                JOB_CARDS,
                new Page.WaitForSelectorOptions()
                    .setState(WaitForSelectorState.ATTACHED)
                    .setTimeout(15000)
            );
        } catch (com.microsoft.playwright.PlaywrightException e) {
            // prepare()中注册的onResponse监听器与此处的等待偶发驱动层竞态（响应对象已释放），重试一次即可恢复
            log.warn("等待岗位卡片加载命中驱动层竞态异常，重试一次: {}", e.getMessage());
            page.waitForTimeout(1000);
            page.waitForSelector(
                JOB_CARDS,
                new Page.WaitForSelectorOptions()
                    .setState(WaitForSelectorState.ATTACHED)
                    .setTimeout(15000)
            );
        }
            // 额外等待一次接口响应，确保 lastApiEntities 刷新（精确匹配PC搜索接口）
            try {
                page.waitForResponse(r -> {
                    try {
                        String u = r.url();
                        return u != null && u.contains("com.liepin.searchfront4c.pc-search-job") && r.status() == 200;
                    } catch (Exception ignored) { return false; }
                }, () -> {});
            } catch (Exception ignored) {}
            info(String.format("正在投递【%s%s】第【%d】页...", cleanKeyword, cityLabel, i + 1));
            submitJob();
            info(String.format("已投递第【%d】页所有的岗位...", i + 1));
            
            // 查找下一页按钮（AntD v5 结构）
            paginationBox = page.locator(PAGINATION_BOX);
            Locator nextLi = paginationBox.locator(NEXT_PAGE);
            if (nextLi.count() > 0) {
                String cls = nextLi.first().getAttribute("class");
                boolean disabled = cls != null && cls.contains("ant-pagination-disabled");
                if (!disabled) {
                    Locator btn = nextLi.first().locator("button.ant-pagination-item-link");
                    if (btn.count() > 0) {
                        btn.first().click();
                    } else {
                        nextLi.first().click();
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        info(String.format("【%s%s】关键词投递完成！", cleanKeyword, cityLabel));
    }

    private String getSearchUrl(String cityCode) {
        String baseUrl = "https://www.liepin.com/zhaopin/?";
        StringBuilder sb = new StringBuilder(baseUrl);
        // 直接拼接参数，参数为空则忽略
        if (cityCode != null && !cityCode.isEmpty()) {
            sb.append("city=").append(cityCode).append("&");
            sb.append("dq=").append(cityCode).append("&");
        }
        if (config.getSalary() != null && !config.getSalary().isEmpty()) {
            // 真实URL确认参数名是salaryCode，不是salary（旧版遗留错误）
            sb.append("salaryCode=").append(config.getSalary()).append("&");
        }
        sb.append("currentPage=0");
        return sb.toString();
    }

    private void setMaxPage(Locator lis) {
        maxPage = 1;
        try {
            int count = lis.count();
            if (count >= 2) {
                String pageText = lis.nth(count - 2).textContent();
                int page = Integer.parseInt(pageText);
                if (page > 1) {
                    maxPage = page;
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void submitJob() {
        // 获取hr数量
        Locator jobCards = page.locator(JOB_CARDS);
        int count = jobCards.count();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < count; i++) {
            if (shouldStop()) {
                info("收到停止指令，结束卡片遍历");
                return;
            }
            // 订阅弹窗可能在处理某张卡片时才弹出（不止在翻页时），换页才检查一次不够——
            // 弹窗一旦残留会挡住后面所有卡片的点击，表现为"只投了第一个就没反应了"，故每张卡片处理前都查一次
            closeSubscribePopupIfPresent();
            // 获取当前岗位卡片（用于后续操作与缺省展示）
            Locator currentJobCard = page.locator(JOB_CARDS).nth(i);
            // 页面下发两次搜索接口响应时，先到后到顺序不定，lastApiEntities的顺序可能和DOM卡片顺序对不上，
            // 所以不能按下标i直接取，改成用卡片自身DOM属性里的jobId去匹配，取不到再退化到按下标取
            Long cardJobId = extractJobIdFromCard(currentJobCard);
            LiepinEntity apiEntity = resolveApiEntity(cardJobId, i);
            // 从接口数据获取展示所需字段，若接口数据缺失则使用缺省占位，仍尝试打招呼
            String jobName = null;
            String companyName = null;
            String salary = null;
            String recruiterName = null;
            String jobArea = null;
            if (apiEntity != null) {
                jobName = safeText(apiEntity.getJobTitle());
                companyName = safeText(apiEntity.getCompName());
                salary = safeText(apiEntity.getJobSalaryText());
                recruiterName = safeText(apiEntity.getHrName());
                jobArea = apiEntity.getJobArea();
            }
            if (recruiterName == null) recruiterName = "HR";
            if (jobName == null) jobName = "岗位";
            if (companyName == null) companyName = "公司";
            if (salary == null) salary = "";

            // 发布时间过滤：多选档位优先；旧配置回退到 publishWithinDays 单阈值
            Integer publishAge = LiepinTimeUtils.daysSincePublish(
                    apiEntity != null ? apiEntity.getJobPublishTime() : null,
                    LocalDateTime.now());
            if (publishAge != null && !isPublishAllowed(publishAge)) {
                log.info("跳过岗位（发布 {} 天前，不在允许的发布时间段）: 【{}】的【{}·{}】岗位",
                        publishAge, companyName, jobName, salary);
                continue;
            }

            // 猎聘接口city/dq是软过滤，会混入外地岗位，这里按城市名前缀二次过滤；拿不到城市信息时保守跳过，不赌它是本地
            if (targetCityName != null) {
                if (jobArea == null || !jobArea.startsWith(targetCityName)) {
                    log.info("跳过岗位（城市不匹配，目标【{}】实际【{}】）: 【{}】的【{}·{}】岗位", targetCityName, jobArea == null ? "未知" : jobArea, companyName, jobName, salary);
                    continue;
                }
            }

            // 公司规模筛选：猎聘搜索接口不支持按规模硬过滤，用已抓取到的 compScale 二次校验
            String compScale = apiEntity != null ? apiEntity.getCompScale() : null;
            if (hasCompanyScaleFilter() && !matchesCompanyScale(compScale)) {
                log.info("跳过岗位（公司规模不匹配，目标【{}】实际【{}】）: 【{}】的【{}·{}】岗位", config.getCompanyScale(), compScale == null ? "未知" : compScale, companyName, jobName, salary);
                continue;
            }

            // 薪资筛选：salaryCode同样是软过滤，用抓到的薪资文本二次校验
            if (hasSalaryFilter() && !matchesSalaryRange(salary)) {
                log.info("跳过岗位（薪资不匹配，目标【{}-{}K】实际【{}】）: 【{}】的【{}】岗位", salaryMinK, salaryMaxK, salary, companyName, jobName);
                continue;
            }

            Long jobIdForUpdate = apiEntity != null ? apiEntity.getJobId() : cardJobId;

            // 重跑时跳过已经投递过的岗位，避免同一个岗位再发一次招呼语
            if (jobIdForUpdate != null && liepinService.isDelivered(jobIdForUpdate)) {
                log.info("跳过岗位（已投递过）: 【{}】的【{}·{}】岗位", companyName, jobName, salary);
                continue;
            }

            // 同一 HR 只打一次招呼：同一个 HR 发布多个岗位时，只处理第一个
            String hrKey = null;
            if (Boolean.TRUE.equals(config.getSameHrFilter())) {
                hrKey = hrKeyOf(apiEntity);
                if (hrKey != null && greetedHrKeys.contains(hrKey)) {
                    log.info("跳过岗位（同一 HR 已打过招呼）: 【{}】的【{}·{}】岗位", companyName, jobName, salary);
                    continue;
                }
            }

            try {
                // 使用JavaScript滚动到卡片位置，更稳定
                try {
                    // 先滚动到卡片位置
                    page.evaluate("(element) => element.scrollIntoView({behavior: 'instant', block: 'center'})", currentJobCard.elementHandle());
                    // PlaywrightUtil.sleep(1); // 等待滚动完成
                    
                    // 再次确保元素在视窗中
                    page.evaluate("(element) => { const rect = element.getBoundingClientRect(); if (rect.top < 0 || rect.bottom > window.innerHeight) { element.scrollIntoView({behavior: 'instant', block: 'center'}); } }", currentJobCard.elementHandle());
                    // PlaywrightUtil.sleep(1);
                } catch (Exception scrollError) {
                    log.warn("JavaScript滚动失败，尝试页面滚动: {}", scrollError.getMessage());
                    // 备用方案：滚动页面到大概位置
                    page.evaluate("window.scrollBy(0, " + (i * 200) + ")");
                    // PlaywrightUtil.sleep(1);
                }
                
                // 查找HR区域 - 尝试多种可能的HR标签选择器
                Locator hrArea = null;
                String[] hrSelectors = {
                    ".recruiter-info-box",  // 根据页面源码，这是主要的HR区域类名
                    ".recruiter-info, .hr-info, .contact-info",
                    "[class*='recruiter'], [class*='hr-'], [class*='contact']",
                    ".job-card-footer, .card-footer",
                    ".job-bottom, .bottom-info"
                };
                
                for (String selector : hrSelectors) {
                    Locator tempHrArea = currentJobCard.locator(selector);
                    if (tempHrArea.count() > 0) {
                        hrArea = tempHrArea.first();
                        log.debug("找到HR区域，使用选择器: {}", selector);
                        break;
                    }
                }
                
                // 如果找不到特定的HR区域，使用整个卡片
                if (hrArea == null) {
                    log.debug("未找到特定HR区域，使用整个岗位卡片");
                    hrArea = currentJobCard;
                }
                
                // 鼠标悬停到HR区域，触发按钮显示 - 简化悬停逻辑
                boolean hoverSuccess = false;
                int hoverRetries = 3;
                for (int retry = 0; retry < hoverRetries; retry++) {
                    try {
                        // 检查HR区域是否可见，如果不可见则跳过悬停
                        if (!hrArea.isVisible()) {
                            log.debug("HR区域不可见，跳过悬停操作");
                            hoverSuccess = true; // 设为成功，继续后续流程
                            break;
                        }
                        
                        // 直接悬停，不再进行复杂的微调
                        hrArea.hover(new Locator.HoverOptions().setTimeout(5000));
                        hoverSuccess = true;
                        break;
                    } catch (Exception hoverError) {
                        log.warn("第{}次悬停失败: {}", retry + 1, hoverError.getMessage());
                        if (retry < hoverRetries - 1) {
                            // 重试前重新滚动确保元素可见
                            try {
                                page.evaluate("(element) => element.scrollIntoView({behavior: 'instant', block: 'center'})", currentJobCard.elementHandle());
                                Thread.sleep(500); // 等待滚动完成
                            } catch (Exception e) {
                                log.warn("重试前滚动失败: {}", e.getMessage());
                            }
                        }
                    }
                }
                
                if (!hoverSuccess) {
                    log.warn("悬停操作失败，但继续查找按钮");
                    // 不再跳过，而是继续查找按钮，因为有些按钮可能不需要悬停就能显示
                }
                
                // PlaywrightUtil.sleep(1); // 等待按钮显示
                
                // 获取hr名字
                // 已从接口获取 HR 名字，无需再从页面读
                
            } catch (Exception e) {
                log.error("处理岗位卡片失败: {}", e.getMessage());
                continue;
            }
            
            // 查找聊一聊按钮
            Locator button = null;
            String buttonText = "";
            try {
                // 在当前岗位卡片中查找按钮，尝试多种选择器
                
                String[] buttonSelectors = {
                    "button.ant-btn.ant-btn-primary.ant-btn-round",
                    "button.ant-btn.ant-btn-round.ant-btn-primary", 
                    "button[class*='ant-btn'][class*='primary']",
                    "button[class*='ant-btn'][class*='round']",
                    "button[class*='chat'], button[class*='talk']",
                    ".chat-btn, .talk-btn, .contact-btn",
                    "button:has-text('聊一聊')",
                    "button" // 最后尝试所有按钮
                };
                
                for (String selector : buttonSelectors) {
                    try {
                        Locator tempButtons = currentJobCard.locator(selector);
                        int buttonCount = tempButtons.count();
                        log.debug("选择器 '{}' 找到 {} 个按钮", selector, buttonCount);
                        
                        for (int j = 0; j < buttonCount; j++) {
                            Locator tempButton = tempButtons.nth(j);
                            try {
                                if (tempButton.isVisible()) {
                                    String text = tempButton.textContent();
                                    log.debug("按钮文本: '{}'", text);
                                    if (text != null && !text.trim().isEmpty()) {
                                        button = tempButton;
                                        buttonText = text.trim();
                                        // 猎聘岗位卡片有两种投递入口："聊一聊"(沟通类)和"投简历"/"投递简历"(直接申请类，
                                        // 卡片上实际文案是"投简历"三个字，不是"投递简历"，两种都要认)
                                        if (text.contains("聊一聊") || text.contains("投简历") || text.contains("投递简历")) {
                                            log.debug("找到目标按钮: '{}'", text);
                                            break;
                                        }
                                    }
                                }
                            } catch (Exception ignore) {
                                log.debug("获取按钮文本失败: {}", ignore.getMessage());
                            }
                        }

                        if (button != null && (buttonText.contains("聊一聊") || buttonText.contains("投简历") || buttonText.contains("投递简历"))) {
                            break;
                        }
                    } catch (Exception e) {
                        log.debug("选择器 '{}' 查找失败: {}", selector, e.getMessage());
                    }
                }
                
            } catch (Exception e) {
                log.error("查找按钮失败: {}", e.getMessage());
                // 不再保存页面源码
                continue;
            }
            
            // jobIdForUpdate 已在前面解析（优先接口实体，退化到卡片 DOM 属性）

            // 补充详情页字段（岗位描述、HR活跃状态、招聘状态）：列表接口里没有这些字段，
            // 必须额外打开一次岗位详情页才能拿到，用于"投递分析"页展示。失败不影响投递主流程
            if (jobIdForUpdate != null && apiEntity != null && apiEntity.getJobLink() != null) {
                try {
                    JobDetailInfo detail = fetchLiepinJobDetail(apiEntity.getJobLink());
                    if (detail != null) {
                        // HR 活跃度过滤：多选档位优先；旧配置回退到 hrActiveWithinDays
                        Integer activeAge = LiepinTimeUtils.daysSinceActive(detail.hrActiveStatus(), LocalDateTime.now());
                        if (activeAge != null && !isHrActiveAllowed(activeAge)) {
                            log.info("跳过岗位（HR {} 天未活跃，不在允许的活跃档位）: 【{}】的【{}·{}】岗位",
                                    activeAge, companyName, jobName, salary);
                            continue;
                        }

                        // 发布时间缺失/解析不出时，用详情页“X天前更新”兜底
                        Integer detailPublishAge = LiepinTimeUtils.daysSincePublish(apiEntity.getJobPublishTime(), LocalDateTime.now());
                        if (detailPublishAge == null) {
                            Integer updateAge = LiepinTimeUtils.daysSinceUpdate(detail.recruitmentStatus(), LocalDateTime.now());
                            if (updateAge != null && !isPublishAllowed(updateAge)) {
                                log.info("跳过岗位（详情页显示 {} 天前更新，不在允许的发布时间段）: 【{}】的【{}·{}】岗位",
                                        updateAge, companyName, jobName, salary);
                                continue;
                            }
                        }

                        liepinService.updateJobDetail(jobIdForUpdate, detail.jobDescription(), detail.hrActiveStatus(), detail.recruitmentStatus());
                    }
                } catch (Exception e) {
                    log.debug("获取岗位详情页字段失败，跳过: {}", e.getMessage());
                }
            }

            // 调试模式：仅遍历不投递
            if (Boolean.TRUE.equals(config.getDebugger())) {
                log.info("调试模式：仅遍历岗位，不投递 | 公司：{} | 岗位：{}", companyName, jobName);
                continue;
            }

            // 检查按钮文本并点击
            if (button != null && buttonText.contains("聊一聊")) {
                try {
                    // 在点击按钮前进行鼠标微调，先向右移动2像素，再向左移动2像素
                    try {
                        var boundingBox = button.boundingBox();
                        if (boundingBox != null) {
                            double centerX = boundingBox.x + boundingBox.width / 2;
                            double centerY = boundingBox.y + boundingBox.height / 2;
                            
                            // 先移动到按钮中心
                            page.mouse().move(centerX, centerY);
                            Thread.sleep(50);
                            
                            // 向右移动2像素
                            page.mouse().move(centerX + 2, centerY);
                            Thread.sleep(50);
                            
                            // 向左移动2像素（回到中心再向左2像素）
                            page.mouse().move(centerX - 2, centerY);
                            Thread.sleep(50);
                            
                            // 回到中心位置
                            page.mouse().move(centerX, centerY);
                            Thread.sleep(50);
                            
                            log.debug("完成鼠标微调，准备点击按钮");
                        }
                    } catch (Exception moveError) {
                        log.warn("鼠标微调失败，直接点击按钮: {}", moveError.getMessage());
                    }
                    
                    button.click();
                    PlaywrightUtil.sleep(2); // 等待聊天面板加载

                    // 猎聘点击"聊一聊"会自动发送一句系统默认招呼语，这里补发自定义打招呼语，
                    // 再点"发简历"直接投递简历，最后关闭聊天窗口
                    try {
                        // 等待聊天弹窗加载
                        page.waitForSelector(CHAT_HEADER, new Page.WaitForSelectorOptions().setTimeout(5000));

                        // 补发自定义打招呼语。
                        // 猎聘点「聊一聊」会先发账号里的默认招呼语；如果用户已在猎聘设置过招呼语，
                        // 这里再发 sayHi 就会变成两条，所以用 sendSayHi 开关控制补发。
                        String sayHi = config.getSayHi();
                        if (Boolean.FALSE.equals(config.getSendSayHi())) {
                            log.info("已关闭补发自定义招呼语，仅使用猎聘默认招呼语");
                        } else if (sayHi != null && !sayHi.isBlank()) {
                            try {
                                Locator input = page.locator(CHAT_INPUT);
                                if (input.count() > 0) {
                                    input.first().click();
                                    input.first().fill(sayHi);
                                    input.first().press("Enter");
                                    PlaywrightUtil.sleep(1);
                                }
                            } catch (Exception e) {
                                log.warn("补发自定义打招呼语失败: {}", e.getMessage());
                            }
                        }

                        // 点击"发简历"直接投递简历（使用猎聘账号里已上传的默认附件简历）
                        try {
                            Locator resumeBtn = page.locator(RESUME_BTN);
                            if (resumeBtn.count() > 0 && resumeBtn.first().isVisible()) {
                                resumeBtn.first().click(new Locator.ClickOptions().setForce(true));
                                PlaywrightUtil.sleep(1);
                                // 点击后会弹出"选择附件简历"二次确认框，默认已选中简历，需再点"立即投递"确认
                                boolean confirmed = false;
                                try {
                                    Locator confirmBtn = page.locator("button:has-text('立即投递')");
                                    if (confirmBtn.count() > 0) {
                                        confirmBtn.first().waitFor(new Locator.WaitForOptions().setTimeout(3000));
                                        confirmBtn.first().click(new Locator.ClickOptions().setForce(true));
                                        PlaywrightUtil.sleep(1);
                                        confirmed = true;
                                    }
                                } catch (Exception e2) {
                                    log.warn("点击立即投递确认按钮失败: {}", e2.getMessage());
                                }
                                if (confirmed) {
                                    log.info("已发送附件简历: 【{}】的【{}】岗位", companyName, jobName);
                                } else {
                                    log.warn("未找到「立即投递」确认按钮，简历可能未发出: 【{}】的【{}】岗位", companyName, jobName);
                                }
                            } else {
                                log.warn("未找到「发简历」按钮，请确认猎聘账号已上传附件简历: 【{}】的【{}】岗位", companyName, jobName);
                            }
                        } catch (Exception e) {
                            log.warn("点击发简历按钮失败: {}", e.getMessage());
                        }

                        // 关闭聊天窗口：把关闭按钮限定在聊天弹窗容器内查找，而不是全页面搜——
                        // span[aria-label='close']在页面上不止聊天弹窗一处会用到，全页面搜到的
                        // 可能是别的元素，点了没用，真正的聊天弹窗留在页面上挡住后面所有卡片，
                        // 表现就是"只投了第一个就没反应了"
                        Locator close = page.locator(CHAT_HEADER).locator(CHAT_CLOSE);
                        if (close.count() > 0) {
                            PlaywrightUtil.sleep(1);
                            close.first().click(new Locator.ClickOptions().setForce(true));
                        } else {
                            // 找不到时按Esc兜底，避免弹窗残留
                            page.keyboard().press("Escape");
                        }

                        resultList.add(sb.append("【").append(companyName).append(" ").append(jobName).append(" ").append(salary).append(" ").append(recruiterName).append(" ").append("】").toString());
                        sb.setLength(0);
                        // 点击成功后标记为已投递
                        if (jobIdForUpdate != null) {
                            liepinService.markDelivered(jobIdForUpdate);
                        }
                        if (hrKey != null) {
                            greetedHrKeys.add(hrKey);
                        }

                    } catch (Exception e) {
                        log.warn("关闭聊天窗口失败，但投递可能已成功: {}", e.getMessage());
                        // 即使关闭失败，也认为投递成功
                        resultList.add(sb.append("【").append(companyName).append(" ").append(jobName).append(" ").append(salary).append(" ").append(recruiterName).append(" ").append("】").toString());
                        sb.setLength(0);
                        if (jobIdForUpdate != null) {
                            liepinService.markDelivered(jobIdForUpdate);
                        }
                        if (hrKey != null) {
                            greetedHrKeys.add(hrKey);
                        }
                    }

                } catch (Exception e) {
                    log.error("点击按钮失败: {}", e.getMessage());
                }
            } else if (button != null && (buttonText.contains("投简历") || buttonText.contains("投递简历"))) {
                // 直接投递类岗位：点击即完成投递，无聊天窗口需要关闭
                try {
                    button.click();
                    PlaywrightUtil.sleep(1);
                    resultList.add(sb.append("【").append(companyName).append(" ").append(jobName).append(" ").append(salary).append(" ").append(recruiterName).append(" ").append("】").toString());
                    sb.setLength(0);
                    if (jobIdForUpdate != null) {
                        liepinService.markDelivered(jobIdForUpdate);
                    }
                    if (hrKey != null) {
                        greetedHrKeys.add(hrKey);
                    }
                    log.info("投递简历成功: 【{}】的【{}·{}】岗位", companyName, jobName, salary);
                } catch (Exception e) {
                    log.error("点击投递简历按钮失败: {}", e.getMessage());
                }
            } else {
                // 如果按钮是“继续聊”，视为已投递
                if (button != null && buttonText.contains("继续聊") && jobIdForUpdate != null) {
                    liepinService.markDelivered(jobIdForUpdate);
                    if (hrKey != null) {
                        greetedHrKeys.add(hrKey);
                    }
                }
                if (button != null) {
                    log.info("跳过岗位（按钮文本不匹配）: 【{}】的【{}·{}】岗位，按钮文本: '{}'", companyName, jobName, salary, buttonText);
                } else {
                    log.info("跳过岗位（未找到任何按钮）: 【{}】的【{}·{}】岗位", companyName, jobName, salary);
                }
            }
        }
    }

    // 从岗位卡片的 data 属性中提取 jobId（兼容 lastApiEntities 缺失场景）
    private Long extractJobIdFromCard(Locator card) {
        try {
            String ext = card.getAttribute("data-tlg-ext");
            if (ext != null && !ext.isEmpty()) {
                try {
                    String decoded = java.net.URLDecoder.decode(ext, java.nio.charset.StandardCharsets.UTF_8);
                    com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(decoded);
                    String jobIdStr = node.path("jobId").asText(null);
                    if (jobIdStr != null && !jobIdStr.isEmpty()) {
                        return Long.parseLong(jobIdStr);
                    }
                } catch (Exception ignore) {
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\\\\"jobId\\\\\":\\\\\"(\\d+)\\\\\"").matcher(ext);
                    if (m.find()) {
                        return Long.parseLong(m.group(1));
                    }
                }
            }
            String scm = card.getAttribute("data-tlg-scm");
            if (scm != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("jobId=(\\d+)").matcher(scm);
                if (m.find()) {
                    return Long.parseLong(m.group(1));
                }
            }
        } catch (Exception ignore) {}
        return null;
    }
}
