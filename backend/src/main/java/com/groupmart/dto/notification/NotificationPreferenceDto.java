package com.groupmart.dto.notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreferenceDto {

    private String category;
    private String label;
    private String description;
    private boolean enabled;
    private boolean mandatory;
}
