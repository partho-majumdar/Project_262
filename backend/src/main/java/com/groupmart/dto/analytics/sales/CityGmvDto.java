package com.groupmart.dto.analytics.sales;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** GMV delivered to one city, used to show where demand actually sits. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityGmvDto {

    private String city;

    private BigDecimal gmv;

    private long orderCount;
}
