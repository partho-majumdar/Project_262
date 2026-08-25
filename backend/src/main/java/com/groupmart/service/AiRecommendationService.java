package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.ai.AiChatRequest;
import com.groupmart.dto.ai.AiChatResponse;
import com.groupmart.dto.ai.RecommendationResponse;
import com.groupmart.dto.product.ProductDto;

public interface AiRecommendationService {

    RecommendationResponse getPersonalizedRecommendations(String userEmail);

    List<ProductDto> getSimilarProducts(UUID productId);

    AiChatResponse chatWithAiAssistant(String userEmail, AiChatRequest request);
}
