package com.groupmart.service;

import java.util.UUID;

import com.groupmart.dto.seller.*;

public interface SellerService {

    SellerStoreDto createSellerStore(String userEmail, CreateSellerStoreRequest request);

    SellerStoreDto getSellerStoreByEmail(String userEmail);

    SellerStoreDto getSellerStoreBySlug(String storeSlug);

    SellerStoreDto updateSellerStore(String userEmail, UpdateSellerStoreRequest request);

    SellerDashboardOverviewDto getSellerDashboardOverview(String userEmail);

    SellerStoreDto verifySellerStore(UUID storeId, boolean verify);
}
