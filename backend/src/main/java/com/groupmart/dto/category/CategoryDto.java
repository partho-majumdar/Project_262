package com.groupmart.dto.category;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryDto {

    private UUID id;
    private String name;
    private String slug;
    private String description;
    private String imageUrl;
    private UUID parentCategoryId;
    private String parentCategoryName;
    private List<CategoryDto> subCategories;
    private boolean active;
    private LocalDateTime createdAt;
}
