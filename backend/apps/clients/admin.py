from django.contrib import admin # type: ignore[assignment]
from .models import Client, Project

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'company', 'country', 'default_currency', 'created_at')  # type: ignore[assignment]
    list_filter = ('default_currency', 'country')  
    search_fields = ('name', 'email', 'company') 

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'client', 'billing_type', 'currency', 'hourly_rate', 'fixed_price', 'is_archived')  # type: ignore[assignment]
    list_filter = ('billing_type', 'currency', 'is_archived', 'client')  # type: ignore[assignment]
    search_fields = ('name', 'client__name')  # type: ignore[assignment]
