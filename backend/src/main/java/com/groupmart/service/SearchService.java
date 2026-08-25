package com.groupmart.service;

import java.util.List;

import com.groupmart.dto.product.ProductDto;
import com.groupmart.dto.search.SearchFilterRequest;
import com.groupmart.dto.search.SearchResultDto;

public interface SearchService {

    SearchResultDto searchProducts(SearchFilterRequest request);

    List<ProductDto> getSearchSuggestions(String query);
}
