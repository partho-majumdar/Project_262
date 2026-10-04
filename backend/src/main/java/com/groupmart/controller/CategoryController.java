package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.category.CategoryDto;
import com.groupmart.dto.category.CreateCategoryRequest;
import com.groupmart.dto.category.UpdateCategoryRequest;
import com.groupmart.service.CategoryService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryDto>>> getAllCategories() {
        List<CategoryDto> categories = categoryService.getAllCategories();
        return ResponseEntity.ok(ApiResponse.success("Categories retrieved successfully", categories));
    }

    @GetMapping("/tree")
    public ResponseEntity<ApiResponse<List<CategoryDto>>> getCategoryTree() {
        List<CategoryDto> tree = categoryService.getCategoryTree();
        return ResponseEntity.ok(ApiResponse.success("Category tree hierarchy retrieved successfully", tree));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<CategoryDto>> getCategoryBySlug(@PathVariable String slug) {
        CategoryDto category = categoryService.getCategoryBySlug(slug);
        return ResponseEntity.ok(ApiResponse.success("Category details retrieved successfully", category));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CategoryDto>> createCategory(@Valid @RequestBody CreateCategoryRequest request) {
        CategoryDto category = categoryService.createCategory(request);
        return ResponseEntity.ok(ApiResponse.success("Category created successfully", category));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CategoryDto>> updateCategory(@PathVariable UUID id, @Valid @RequestBody UpdateCategoryRequest request) {
        CategoryDto category = categoryService.updateCategory(id, request);
        return ResponseEntity.ok(ApiResponse.success("Category updated successfully", category));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(@PathVariable UUID id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.ok(ApiResponse.success("Category deleted successfully", null));
    }
}
