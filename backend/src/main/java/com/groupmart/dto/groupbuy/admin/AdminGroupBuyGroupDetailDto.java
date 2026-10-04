package com.groupmart.dto.groupbuy.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

import com.groupmart.dto.groupbuy.GroupBuyDisputeDto;
import com.groupmart.dto.groupbuy.GroupBuyGroupDto;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminGroupBuyGroupDetailDto {

    private GroupBuyGroupDto group;
    private String closeCode;
    private String closeReasonLabel;
    /** Every membership row, including members who left, with contact and payment details. */
    private List<AdminGroupBuyParticipantDto> members;
    private List<GroupBuyDisputeDto> disputes;
}
