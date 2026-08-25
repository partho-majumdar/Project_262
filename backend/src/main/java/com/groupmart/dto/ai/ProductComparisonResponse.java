package com.groupmart.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

import com.groupmart.dto.product.ProductDto;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductComparisonResponse {

    private ProductDto product1;
    private ProductDto product2;
    private String winnerProductId;
    private String aiSummaryRecommendation;
    private Map<String, String> specComparisonMatrix;
    private List<String> product1Pros;
    private List<String> product2Pros;
}
