package com.groupmart.service;

import com.groupmart.dto.support.SendSupportMessageRequest;
import com.groupmart.dto.support.SupportMessageDto;

import java.util.List;
import java.util.UUID;

public interface SupportService {

    List<SupportMessageDto> getConversation(String userEmail, UUID partnerId);

    List<SupportMessageDto> getInbox(String userEmail);

    List<SupportMessageDto> getSent(String userEmail);

    SupportMessageDto sendMessage(String senderEmail, SendSupportMessageRequest request);

    List<SupportMessageDto> getConversationPartners(String userEmail);

    List<SupportMessageDto> getCustomerConversations(String sellerEmail);

    long getUnreadCount(String userEmail);

    SupportMessageDto markAsRead(String userEmail, UUID messageId);
}
