from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging
from rest_framework.exceptions import APIException, ValidationError
class DomainError(Exception):
    """Base class for all domain-level business logic exceptions."""
    pass

class InvoiceStateError(DomainError):
    """Raised when an invoice transition is invalid (e.g. editing a SENT invoice)."""
    pass

class ClientDeleteError(DomainError):
    """Raised when trying to delete a client that has invoices."""
    pass

def custom_exception_handler(exc: Exception, context: dict) -> Response | None:
    """
    Maps DomainError to 409 Conflict.
    
    Args:
        exc: The exception raised.
        context: Context dictionary passed by DRF.
        
    Returns:
        Response: 409 response if DomainError, otherwise delegates to default handler.
    """
    response = exception_handler(exc, context)
    
    if isinstance(exc, DomainError):
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_409_CONFLICT
        )
        
    return response
class PaymentValidationError(DomainError):
    """Raised when a payment violates business rules (e.g. overpayment, non-sent invoice, negative amounts)."""
    pass
class TimeEntryLockedError(DomainError):
    """Raised when attempting to edit or delete a billed/locked time entry (US-07)."""
    pass


logger = logging.getLogger(__name__)

def consistent_exception_handler(exc: Exception, context: dict) -> Response:
    """Enhanced DRF exception handler providing a unified error response payload.

    Args:
        exc: The Python exception raised during request processing.
        context: Dict containing request, view, and args.

    Returns:
        Response: DRF Response with standardized error JSON schema.
    """
    # Call DRF's default exception handler first to get the standard response
    response = exception_handler(exc, context)

    # Handle business logic domain errors (maps to 409 Conflict)
    if isinstance(exc, DomainError):
        return Response(
            {
                "error": {
                    "code": exc.__class__.__name__,
                    "message": str(exc),
                    "details": None,
                }
            },
            status=status.HTTP_409_CONFLICT,
        )

    # If DRF handled it (e.g. ValidationError, AuthenticationFailed, NotFound)
    if response is not None:
        error_code = "API_ERROR"
        message = "An error occurred while processing your request."
        details = response.data

        if response.status_code == status.HTTP_400_BAD_REQUEST:
            error_code = "VALIDATION_ERROR"
            message = "Validation failed. Please check the submitted fields."
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            error_code = "UNAUTHORIZED"
            message = "Authentication credentials were not provided or have expired."
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            error_code = "FORBIDDEN"
            message = "You do not have permission to perform this action."
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            error_code = "NOT_FOUND"
            message = "The requested resource was not found."
        elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            error_code = "RATE_LIMITED"
            message = "Too many requests. Please slow down."

        # If DRF provided a simple string "detail", use it as message
        if isinstance(response.data, dict) and "detail" in response.data:
            message = str(response.data["detail"])
            details = None

        response.data = {
            "error": {
                "code": error_code,
                "message": message,
                "details": details,
            }
        }
        return response

    # Fallback for unhandled exceptions (HTTP 500)
    logger.exception("Unhandled server exception: %s", exc, exc_info=context.get("request"))
    return Response(
        {
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred. Our team has been notified.",
                "details": None,
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

