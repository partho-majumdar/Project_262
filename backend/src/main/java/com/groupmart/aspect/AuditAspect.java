package com.groupmart.aspect;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.groupmart.service.AuditLogService;

@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditLogService auditLogService;

    @AfterReturning(pointcut = "@annotation(auditActivity)", returning = "result")
    public void logAuditActivity(JoinPoint joinPoint, AuditActivity auditActivity, Object result) {
        String userEmail = "ANONYMOUS";
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            userEmail = auth.getName();
        }

        String ipAddress = "127.0.0.1";
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest request = attrs.getRequest();
            String xHeader = request.getHeader("X-Forwarded-For");
            if (xHeader != null && !xHeader.isEmpty()) {
                ipAddress = xHeader.split(",")[0].trim();
            } else {
                ipAddress = request.getRemoteAddr();
            }
        }

        String details = "Executed " + joinPoint.getSignature().getName() + " on " + auditActivity.resource();
        auditLogService.logActivity(userEmail, auditActivity.action(), auditActivity.resource(), details, ipAddress);
    }
}
