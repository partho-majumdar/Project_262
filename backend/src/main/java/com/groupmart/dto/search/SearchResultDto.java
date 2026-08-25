package com.groupmart.dto.search;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

import com.groupmart.dto.product.ProductDto;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResultDto {

    private List<ProductDto> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private BigDecimal priceRangeMin;
    private BigDecimal priceRangeMax;
}
