package com.groupmart.service.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.entity.GroupReverseDemandStatus;
import com.groupmart.repository.GroupReverseDemandRepository;
import com.groupmart.service.AdminGroupReverseService;
import com.groupmart.service.GroupReverseDemandService;

/**
 * Administrative moderation of group reverse demands.
 * <p>
 * A thin adapter: the actual cancellation is delegated to
 * {@link GroupReverseDemandService#cancelByAdmin} so there is one implementation of "release every
 * member's reservation", not two that can drift apart.
 */
@Service
@RequiredArgsConstructor
public class AdminGroupReverseServiceImpl implements AdminGroupReverseService {

    private final GroupReverseDemandRepository demandRepository;
    private final GroupReverseDemandService demandService;
    private final GroupReverseMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public List<GroupReverseDemandDto> listDemands(GroupReverseDemandStatus status) {
        LocalDateTime now = LocalDateTime.now();
        List<com.groupmart.entity.GroupReverseDemand> demands = status != null
                ? demandRepository.findByStatusOrderByCreatedAtDesc(status)
                : demandRepository.findAll();
        return demands.stream().map(demand -> mapper.toDemandDto(demand, now)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GroupReverseDemandDto getDemand(UUID demandId) {
        return mapper.toDemandDto(demandRepository.findById(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId)),
                LocalDateTime.now());
    }

    @Override
    @Transactional
    public GroupReverseDemandDto cancelAsAdmin(UUID demandId, String adminEmail, String reason) {
        return demandService.cancelByAdmin(demandId, adminEmail, reason);
    }
}
