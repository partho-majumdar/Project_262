package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.auth.SellerApplicationRequest;
import com.groupmart.dto.seller.*;
import com.groupmart.entity.SellerStatus;

public interface SellerService {

    SellerApplicationDto submitSellerApplication(String userEmail, SellerApplicationRequest request);

    SellerApplicationDto getSellerApplicationByEmail(String userEmail);

    SellerStoreDto createSellerStore(String userEmail, CreateSellerStoreRequest request);

    SellerStoreDto getSellerStoreByEmail(String userEmail);

    SellerStoreDto getSellerStoreBySlug(String storeSlug);

    SellerStoreDto updateSellerStore(String userEmail, UpdateSellerStoreRequest request);

    SellerDashboardOverviewDto getSellerDashboardOverview(String userEmail);

    SellerStoreDto verifySellerStore(UUID storeId, boolean verify);

    SellerApplicationDto reviewSellerApplication(UUID userId, SellerStatus decision, String reason, String adminEmail);

    List<SellerApplicationDto> getAllSellerApplications();

    List<PublicSellerStoreDto> getAllPublicSellers();
}
