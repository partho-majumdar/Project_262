package com.groupmart.service.impl;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.dto.audit.AuditLogDto;
import com.groupmart.dto.audit.AuditLogSearchRequest;
import com.groupmart.entity.AuditLog;
import com.groupmart.repository.AuditLogRepository;
import com.groupmart.service.AuditLogService;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditLogServiceImpl implements AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Override
    @Transactional
    public void logActivity(String userEmail, String action, String resource, String details, String ipAddress) {
        AuditLog auditLog = AuditLog.builder()
                .userEmail(userEmail)
                .action(action)
                .resource(resource)
                .details(details)
                .ipAddress(ipAddress)
                .build();
        auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogDto> getAuditLogs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return auditLogRepository.findAll(pageable).map(this::mapToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogDto> searchAuditLogs(AuditLogSearchRequest request) {
        int pageNumber = request.getPage() != null ? request.getPage() : 0;
        int pageSize = request.getSize() != null ? request.getSize() : 50;

        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (request.getQuery() != null && !request.getQuery().trim().isEmpty()) {
                String term = "%" + request.getQuery().trim().toLowerCase() + "%";
                Predicate actionMatch = cb.like(cb.lower(root.get("action")), term);
                Predicate emailMatch = cb.like(cb.lower(root.get("userEmail")), term);
                Predicate resourceMatch = cb.like(cb.lower(root.get("resource")), term);
                predicates.add(cb.or(actionMatch, emailMatch, resourceMatch));
            }

            if (request.getUserEmail() != null && !request.getUserEmail().trim().isEmpty()) {
                predicates.add(cb.equal(cb.lower(root.get("userEmail")), request.getUserEmail().trim().toLowerCase()));
            }

            if (request.getAction() != null && !request.getAction().trim().isEmpty()) {
                predicates.add(cb.equal(root.get("action"), request.getAction().trim()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return auditLogRepository.findAll(spec, pageable).map(this::mapToDto);
    }

    private AuditLogDto mapToDto(AuditLog auditLog) {
        return AuditLogDto.builder()
                .id(auditLog.getId())
                .userEmail(auditLog.getUserEmail())
                .action(auditLog.getAction())
                .resource(auditLog.getResource())
                .details(auditLog.getDetails())
                .ipAddress(auditLog.getIpAddress())
                .timestamp(auditLog.getCreatedAt())
                .build();
    }
}
