package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.category.CategoryDto;
import com.groupmart.dto.category.CreateCategoryRequest;
import com.groupmart.dto.category.UpdateCategoryRequest;

public interface CategoryService {

    List<CategoryDto> getAllCategories();

    List<CategoryDto> getCategoryTree();

    CategoryDto getCategoryBySlug(String slug);

    CategoryDto getCategoryById(UUID id);

    CategoryDto createCategory(CreateCategoryRequest request);

    CategoryDto updateCategory(UUID id, UpdateCategoryRequest request);

    void deleteCategory(UUID id);
}
