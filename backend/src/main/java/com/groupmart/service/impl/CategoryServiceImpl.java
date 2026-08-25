package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.category.CategoryDto;
import com.groupmart.dto.category.CreateCategoryRequest;
import com.groupmart.dto.category.UpdateCategoryRequest;
import com.groupmart.entity.Category;
import com.groupmart.repository.CategoryRepository;
import com.groupmart.service.CategoryService;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CategoryDto> getAllCategories() {
        return categoryRepository.findByActiveTrueOrderByNameAsc()
                .stream()
                .map(this::mapToDtoFlat)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryDto> getCategoryTree() {
        return categoryRepository.findByParentCategoryIsNullAndActiveTrueOrderByNameAsc()
                .stream()
                .map(this::mapToDtoRecursive)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CategoryDto getCategoryBySlug(String slug) {
        Category category = categoryRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "slug", slug));
        return mapToDtoRecursive(category);
    }

    @Override
    @Transactional(readOnly = true)
    public CategoryDto getCategoryById(UUID id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        return mapToDtoRecursive(category);
    }

    @Override
    @Transactional
    public CategoryDto createCategory(CreateCategoryRequest request) {
        if (categoryRepository.existsByName(request.getName())) {
            throw new ApiException("Category with name '" + request.getName() + "' already exists", HttpStatus.CONFLICT);
        }

        String slug = generateSlug(request.getName());

        Category parentCategory = null;
        if (request.getParentCategoryId() != null) {
            parentCategory = categoryRepository.findById(request.getParentCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent Category", "id", request.getParentCategoryId()));
        }

        Category category = Category.builder()
                .name(request.getName().trim())
                .slug(slug)
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .parentCategory(parentCategory)
                .active(request.isActive())
                .build();

        Category saved = categoryRepository.save(category);
        return mapToDtoFlat(saved);
    }

    @Override
    @Transactional
    public CategoryDto updateCategory(UUID id, UpdateCategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));

        if (categoryRepository.existsByNameAndIdNot(request.getName(), id)) {
            throw new ApiException("Another category with name '" + request.getName() + "' already exists", HttpStatus.CONFLICT);
        }

        category.setName(request.getName().trim());
        category.setSlug(generateSlug(request.getName()));
        category.setDescription(request.getDescription());
        category.setImageUrl(request.getImageUrl());
        category.setActive(request.isActive());

        if (request.getParentCategoryId() != null) {
            if (request.getParentCategoryId().equals(id)) {
                throw new ApiException("Category cannot be its own parent", HttpStatus.BAD_REQUEST);
            }
            Category parent = categoryRepository.findById(request.getParentCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent Category", "id", request.getParentCategoryId()));
            category.setParentCategory(parent);
        } else {
            category.setParentCategory(null);
        }

        Category updated = categoryRepository.save(category);
        return mapToDtoFlat(updated);
    }

    @Override
    @Transactional
    public void deleteCategory(UUID id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        categoryRepository.delete(category);
    }

    private String generateSlug(String name) {
        String baseSlug = name.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-");

        String slug = baseSlug;
        int count = 1;
        while (categoryRepository.existsBySlug(slug)) {
            slug = baseSlug + "-" + count++;
        }
        return slug;
    }

    private CategoryDto mapToDtoFlat(Category category) {
        return CategoryDto.builder()
                .id(category.getId())
                .name(category.getName())
                .slug(category.getSlug())
                .description(category.getDescription())
                .imageUrl(category.getImageUrl())
                .parentCategoryId(category.getParentCategory() != null ? category.getParentCategory().getId() : null)
                .parentCategoryName(category.getParentCategory() != null ? category.getParentCategory().getName() : null)
                .active(category.isActive())
                .createdAt(category.getCreatedAt())
                .build();
    }

    private CategoryDto mapToDtoRecursive(Category category) {
        List<CategoryDto> subDtos = null;
        if (category.getSubCategories() != null && !category.getSubCategories().isEmpty()) {
            subDtos = category.getSubCategories().stream()
                    .filter(Category::isActive)
                    .map(this::mapToDtoRecursive)
                    .collect(Collectors.toList());
        }

        return CategoryDto.builder()
                .id(category.getId())
                .name(category.getName())
                .slug(category.getSlug())
                .description(category.getDescription())
                .imageUrl(category.getImageUrl())
                .parentCategoryId(category.getParentCategory() != null ? category.getParentCategory().getId() : null)
                .parentCategoryName(category.getParentCategory() != null ? category.getParentCategory().getName() : null)
                .subCategories(subDtos)
                .active(category.isActive())
                .createdAt(category.getCreatedAt())
                .build();
    }
}
