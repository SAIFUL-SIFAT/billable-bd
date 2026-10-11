from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

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
