package com.groupmart.common.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.converter.HttpMessageNotReadableException;

import com.groupmart.common.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** Postgres words a constraint violation as {@code ... violates <kind> constraint "<name>"}. */
    private static final Pattern CONSTRAINT_IN_MESSAGE =
            Pattern.compile("constraint \"?([A-Za-z0-9_]+)\"?", Pattern.CASE_INSENSITIVE);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFoundException(ResourceNotFoundException ex) {
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(), HttpStatus.NOT_FOUND.value());
        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleApiException(ApiException ex) {
        ApiResponse<Void> response = ApiResponse.error(ex.getMessage(), ex.getStatus().value());
        return new ResponseEntity<>(response, ex.getStatus());
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        ApiResponse<Void> response = ApiResponse.error(
                "This record was updated by someone else. Please refresh and try again.",
                HttpStatus.CONFLICT.value());
        return new ResponseEntity<>(response, HttpStatus.CONFLICT);
    }

    /**
     * A data-integrity failure is a database constraint rejecting the write, and the wrapped cause
     * is the only place the constraint name appears. The old generic message made a stale CHECK
     * constraint indistinguishable from a genuine duplicate, so the constraint is named in the log
     * and the response now says which one blocked the request.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
        String constraint = constraintName(ex);
        String message = constraint == null
                ? "The request conflicts with existing data (duplicate or invalid reference)."
                : "The request conflicts with an existing database rule (" + constraint
                        + "). Please retry, or contact support if it keeps happening.";

        log.error("Data integrity violation{}", constraint == null ? "" : " on constraint " + constraint, ex);

        ApiResponse<Void> response = ApiResponse.error(message, HttpStatus.CONFLICT.value());
        return new ResponseEntity<>(response, HttpStatus.CONFLICT);
    }

    /** Pulls the constraint name out of the driver message, e.g. {@code violates ... "orders_order_type_check"}. */
    private String constraintName(DataIntegrityViolationException ex) {
        Throwable cause = ex;
        while (cause != null) {
            String message = cause.getMessage();
            if (message != null) {
                Matcher matcher = CONSTRAINT_IN_MESSAGE.matcher(message);
                if (matcher.find()) {
                    return matcher.group(1);
                }
            }
            cause = cause.getCause() == cause ? null : cause.getCause();
        }
        return null;
    }

    /**
     * A missing or unreadable request body is a client mistake, not a server fault. Without this
     * the catch-all below turned it into a 500 whose message leaked the handler's Java signature.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.warn("Rejected unreadable request body: {}", ex.getMostSpecificCause().getMessage());

        ApiResponse<Void> response = ApiResponse.error(
                "The request body is missing or malformed.",
                HttpStatus.BAD_REQUEST.value());
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        ApiResponse<Void> response = ApiResponse.error("Validation failed for input data", errors, HttpStatus.BAD_REQUEST.value());
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    /**
     * A request for a path no handler maps to is a client mistake, not a server fault.
     *
     * <p>Without this the catch-all below reports it as 500, which makes a typo'd or stale endpoint
     * look like the application is broken - and, worse, buries genuine server faults in the noise.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(NoResourceFoundException ex) {
        ApiResponse<Void> response = ApiResponse.error(
                "No endpoint " + ex.getResourcePath() + " on this API",
                HttpStatus.NOT_FOUND.value());
        return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGlobalException(Exception ex) {
        // Without this the stack trace is lost entirely, which makes an unexpected 500 the
        // hardest kind of failure to diagnose.
        log.error("Unhandled exception", ex);

        ApiResponse<Void> response = ApiResponse.error(
                ex.getMessage() != null ? ex.getMessage() : "An unexpected server error occurred",
                HttpStatus.INTERNAL_SERVER_ERROR.value()
        );
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
