package com.groupmart.controller;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.dto.groupr.GroupReverseOfferDto;
import com.groupmart.dto.groupr.GroupReverseReasonRequest;
import com.groupmart.dto.groupr.SubmitGroupReverseOfferRequest;
import com.groupmart.service.GroupReverseOfferService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * The seller side of the competitive round: which group demands are open for bidding, and managing
 * this store's own offers.
 * <p>
 * Sellers see the group size, the product, the target price and the deadlines. They do not see who
 * the members are - the demand DTO served here carries no roster, and
 * {@link GroupReverseOfferService#getAvailableDemands} never builds one.
 */
@RestController
@RequestMapping("/api/v1/seller/group-reverse-demands")
@RequiredArgsConstructor
public class SellerGroupReverseController {

    private final GroupReverseOfferService offerService;

    /** Group demands that have reached their target and are accepting competing offers. */
    @GetMapping("/available")
    public ResponseEntity<ApiResponse<List<GroupReverseDemandDto>>> available(Principal principal) {
        return ResponseEntity.ok(ApiResponse.success("Available group demands fetched successfully",
                offerService.getAvailableDemands(email(principal))));
    }

    @PostMapping("/{demandId}/offers")
    public ResponseEntity<ApiResponse<GroupReverseOfferDto>> submit(
            Principal principal, @PathVariable UUID demandId,
            @Valid @RequestBody SubmitGroupReverseOfferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "Your offer has been submitted", offerService.submitOffer(email(principal), demandId, request)));
    }

    /** This store's offers across every demand, with their outcomes. */
    @GetMapping("/my-offers")
    public ResponseEntity<ApiResponse<List<GroupReverseOfferDto>>> myOffers(Principal principal) {
        return ResponseEntity.ok(ApiResponse.success("Your group offers fetched successfully",
                offerService.getMyOffers(email(principal))));
    }

    @PutMapping("/offers/{offerId}")
    public ResponseEntity<ApiResponse<GroupReverseOfferDto>> revise(
            Principal principal, @PathVariable UUID offerId,
            @Valid @RequestBody SubmitGroupReverseOfferRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Your offer has been updated",
                offerService.reviseOffer(email(principal), offerId, request)));
    }

    @PostMapping("/offers/{offerId}/withdraw")
    public ResponseEntity<ApiResponse<GroupReverseOfferDto>> withdraw(
            Principal principal, @PathVariable UUID offerId) {
        return ResponseEntity.ok(ApiResponse.success("Your offer has been withdrawn",
                offerService.withdrawOffer(email(principal), offerId)));
    }

    private static String email(Principal principal) {
        return principal == null ? null : principal.getName();
    }
}
