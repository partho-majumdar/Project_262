package com.groupmart.dto.search;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchFilterRequest {

    private String query;
    private String categorySlug;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private Double minRating;
    private Boolean inStockOnly;
    private String sortBy; // price_asc, price_desc, rating_desc, newest, relevance
    private Integer page; // 0-indexed
    private Integer size;
}
