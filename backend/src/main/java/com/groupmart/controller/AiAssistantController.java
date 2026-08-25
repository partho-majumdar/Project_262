package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.ai.AiAssistantRequest;
import com.groupmart.dto.ai.AiAssistantResponse;
import com.groupmart.service.AiAssistantService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai/assistant")
@RequiredArgsConstructor
public class AiAssistantController {

    private final AiAssistantService aiAssistantService;

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<AiAssistantResponse>> processChat(@RequestBody AiAssistantRequest request) {
        AiAssistantResponse response = aiAssistantService.processAssistantChat(request);
        return ResponseEntity.ok(ApiResponse.success("AI Shopping Assistant response generated", response));
    }

    @GetMapping("/policies")
    public ResponseEntity<ApiResponse<Map<String, String>>> getStorePolicies() {
        Map<String, String> policies = aiAssistantService.getStorePolicies();
        return ResponseEntity.ok(ApiResponse.success("Store policies retrieved", policies));
    }

    @GetMapping("/faqs")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> getFaqs() {
        List<Map<String, String>> faqs = aiAssistantService.getFaqs();
        return ResponseEntity.ok(ApiResponse.success("Store FAQs retrieved", faqs));
    }
}
