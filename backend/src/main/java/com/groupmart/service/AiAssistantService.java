package com.groupmart.service;

import java.util.List;
import java.util.Map;

import com.groupmart.dto.ai.AiAssistantRequest;
import com.groupmart.dto.ai.AiAssistantResponse;

public interface AiAssistantService {

    AiAssistantResponse processAssistantChat(AiAssistantRequest request);

    Map<String, String> getStorePolicies();

    List<Map<String, String>> getFaqs();
}
