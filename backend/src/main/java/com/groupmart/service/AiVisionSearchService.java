package com.groupmart.service;

import java.util.List;

import com.groupmart.dto.ai.*;
import com.groupmart.dto.product.ProductDto;

public interface AiVisionSearchService {

    List<ProductDto> searchByImage(ImageSearchRequest request);

    ProductComparisonResponse compareProducts(ProductComparisonRequest request);

    List<String> getTrendingSearchKeywords();

    SearchAnalyticsDto getSearchAnalytics();
}
