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
