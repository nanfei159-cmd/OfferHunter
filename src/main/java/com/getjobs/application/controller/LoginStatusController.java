package com.getjobs.application.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.getjobs.worker.manager.PlaywrightManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.connector.ClientAbortException;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 猎聘登录状态推送
 */
@Slf4j
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class LoginStatusController {
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final PlaywrightManager playwrightManager;

    private final List<SseEmitter> loginStatusEmitters = new CopyOnWriteArrayList<>();

    /** SSE - 登录状态变化推送 */
    @GetMapping(value = "/jobs/login-status/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamLoginStatus() {
        SseEmitter emitter = new SseEmitter(0L);
        loginStatusEmitters.add(emitter);

        playwrightManager.addLoginStatusListener(this::sendLoginStatusChange);

        emitter.onCompletion(() -> {
            log.info("登录状态SSE连接已完成");
            loginStatusEmitters.remove(emitter);
        });

        emitter.onTimeout(() -> {
            log.info("登录状态SSE连接超时");
            loginStatusEmitters.remove(emitter);
        });

        emitter.onError(e -> {
            log.error("登录状态SSE连接错误", e);
            loginStatusEmitters.remove(emitter);
        });

        try {
            boolean liepinLoggedIn = playwrightManager.isLoggedIn("liepin");

            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of(
                            "message", "已连接到登录状态推送",
                            "liepinLoggedIn", liepinLoggedIn
                    )));
        } catch (IOException e) {
            log.error("发送SSE连接消息失败", e);
        }

        return emitter;
    }

    private void sendLoginStatusChange(PlaywrightManager.LoginStatusChange change) {
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : loginStatusEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("login-status")
                        .data(objectMapper.writeValueAsString(Map.of(
                                "platform", change.platform(),
                                "isLoggedIn", change.isLoggedIn(),
                                "timestamp", change.timestamp()
                        ))));
            } catch (Exception e) {
                if (e instanceof AsyncRequestNotUsableException ||
                        e instanceof ClientAbortException ||
                        (e.getCause() instanceof ClientAbortException) ||
                        (e instanceof IOException && String.valueOf(e.getMessage()).contains("中止了一个已建立的连接"))) {
                    log.debug("登录状态 SSE 客户端已断开，移除连接: {}", e.getMessage());
                    try { emitter.complete(); } catch (Exception ignored) {}
                } else {
                    log.error("发送登录状态消息失败", e);
                }
                deadEmitters.add(emitter);
            }
        }
        loginStatusEmitters.removeAll(deadEmitters);
    }

    /** 心跳 - 登录状态 SSE */
    @Scheduled(fixedRate = 30000)
    public void heartbeatLoginStatus() {
        if (loginStatusEmitters.isEmpty()) return;
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : loginStatusEmitters) {
            try {
                emitter.send(SseEmitter.event().name("ping").data("keep-alive"));
            } catch (Exception e) {
                if (e instanceof AsyncRequestNotUsableException ||
                        e instanceof ClientAbortException ||
                        (e.getCause() instanceof ClientAbortException) ||
                        (e instanceof IOException && String.valueOf(e.getMessage()).contains("中止了一个已建立的连接"))) {
                    log.debug("登录状态 SSE 客户端已断开（心跳），移除连接: {}", e.getMessage());
                    try { emitter.complete(); } catch (Exception ignored) {}
                } else {
                    log.error("发送登录状态心跳失败", e);
                }
                deadEmitters.add(emitter);
            }
        }
        loginStatusEmitters.removeAll(deadEmitters);
    }
}
